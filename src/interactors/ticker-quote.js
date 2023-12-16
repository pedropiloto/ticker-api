const Bugsnag = require("@bugsnag/js");

const CoingeckoGateway = require("../gateways/coingecko-gateway");
const RedisClient = require("../gateways/redis-gateway");
const SUPPORTED_CURRENCIES = require("../supported-currencies");
const { getLogger } = require("../utils/logger");

const logger = getLogger();

const call = async (tickerName) => {
  const cachedResult = await RedisClient.get(tickerName).catch((error) => {
    logger.error(
      `ERROR fetching cache: ${error.stack}, ticker_name: ${tickerName}`
    );
    Bugsnag.notify(error);
  });

  if (cachedResult) {
    return { value: cachedResult, isCached: true };
  }

  const tickerArray = tickerName.split(":");
  if (tickerArray.length !== 2) {
    logger.error(`invalid ticker ${tickerName}`);
    return;
  }

  const coinSymbol = tickerArray[0].toLowerCase();
  const currency = tickerArray[1].toLowerCase();
  const coinsList = await CoingeckoGateway.getCoinsList();
  const providerCoin = coinsList.find((x) => x["symbol"] === coinSymbol);
  
  if (!providerCoin) {
    logger.error(`Unsupported ticker ${tickerName}`);
    return;
  }
  const coinProviderId = providerCoin["id"];
  let result;
  try {
    result = (await CoingeckoGateway.getSimplePrice(coinProviderId, currency))
      .data;
  } catch (error) {
    if (error && error.response && error.response.status && error.response.status === 429) {
      const cachedResult = await RedisClient.get(CoingeckoGateway.COINGECKO_USE_PROXY_KEY).catch((_) => {});
      if(!cachedResult){
        logger.info('Turning on PROXY for coingecko');
        RedisClient.set(CoingeckoGateway.COINGECKO_USE_PROXY_KEY, "true").catch((_) => {});
        RedisClient.expire(CoingeckoGateway.COINGECKO_USE_PROXY_KEY, CoingeckoGateway.COINGECKO_USE_PROXY_KEY_TTL);
      }
    }
    
    logger.error(`Error fetching ticker ${tickerName} from provider: ${error}`);
    Bugsnag.notify(error);
    return;
  }

  const tickerQuoteObject = result[coinProviderId];

  if (
    !tickerQuoteObject ||
    !tickerQuoteObject[currency] ||
    !tickerQuoteObject[`${currency}_24h_change`]
  ) {
    logger.error(
      `Provider did not return quote for ticker: ${tickerName} -> ${coinProviderId} - ${currency}`
    );
    return;
  }

  const change24h =
    Math.round(Number(tickerQuoteObject[`${currency}_24h_change`]) * 100) / 100;
  const quoteResult = `${tickerQuoteObject[currency]};${change24h}`;
  const expireTTL = process.env.REDIS_TICKER_MARKET_TTL || 5;

  RedisClient.set(tickerName, quoteResult).catch((error) => {
    logger.error(
      `ERROR saving cache: ${error.stack}, ticker_name: ${tickerName}`
    );
    Bugsnag.notify(error);
  });
  RedisClient.expire(tickerName, expireTTL);

  return { value: quoteResult, isCached: false };
};

const listConfig = async (startIndex, endIndex) => {
  const coinsList = await CoingeckoGateway.getCoinsList();
  const currenciesList = SUPPORTED_CURRENCIES;

  return {
    coins: {
      data: coinsList
        .map((x) => x["symbol"].toUpperCase())
        .slice(startIndex, endIndex),
      total: coinsList.length,
    },
    currencies: currenciesList.map((x) => x.toUpperCase()),
  };
};

const getCoin = async (coinSymbol) => {
  const coinsList = await CoingeckoGateway.getCoinsList();
  const coin = coinsList.find((x) => x["symbol"] === coinSymbol.toLowerCase());

  if (!coin) {
    return;
  }

  return {
    base_id: coin["id"],
    base: coin["symbol"].toUpperCase(),
  };
};

const getCurrencies = async () => {
  return SUPPORTED_CURRENCIES.map((x) => x.toUpperCase());
};

module.exports = { call, listConfig, getCoin, getCurrencies };
