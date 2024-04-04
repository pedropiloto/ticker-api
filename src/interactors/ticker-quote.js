const Bugsnag = require("@bugsnag/js");

const CoingeckoGateway = require("../gateways/coingecko-gateway");
const RedisClient = require("../gateways/redis-gateway");
const SUPPORTED_CURRENCIES = require("../supported-currencies");
const COINGECKO_TICKER_EXCEPTIONS_MAP = require("../coingecko-ticker-exceptions-map");
const { getLogger } = require("../utils/logger");
const { UnsupportedTickerError } = require("../errors");

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
    throw new UnsupportedTickerError();
  }

  const coinSymbol = tickerArray[0].toLowerCase();
  const currency = tickerArray[1].toLowerCase();
  let coinProviderId;
  let result;
    if (COINGECKO_TICKER_EXCEPTIONS_MAP[coinSymbol]) {
      coinProviderId = COINGECKO_TICKER_EXCEPTIONS_MAP[coinSymbol]
    } else {
      const coinsList = await getAllCoinsList();
      if (!coinsList) {
        throw new Error("Failed to retrieve coinslist");
      }
      const providerCoin = coinsList.find((x) => x["symbol"] === coinSymbol);
      if (!providerCoin) {
        logger.error(`Unsupported ticker ${tickerName}`);
        throw new UnsupportedTickerError();
      }
      coinProviderId = providerCoin["id"];
    }
  try {
    result = (await CoingeckoGateway.executeRateLimitedRequest(CoingeckoGateway.getSimplePrice, coinProviderId, currency))
      .data;
  } catch (error) {
    logger.error(`Error fetching ticker ${tickerName} from provider: ${error}`);
    throw error;
  }

  if (!result) {
    logger.error(
      `Result undefined. Provider did not return quote for ticker: ${tickerName} -> ${coinProviderId} - ${currency}`
    );
    throw new Error(`Result undefined. Provider did not return quote for ticker: ${tickerName} -> ${coinProviderId} - ${currency}`)
  }

  const tickerQuoteObject = result[coinProviderId];
  if (!tickerQuoteObject ||
    !tickerQuoteObject[currency] ||
    !tickerQuoteObject[`${currency}_24h_change`]
  ) {
    logger.error(
      `Provider did not return quote for ticker: ${tickerName} -> ${coinProviderId} - ${currency}`
    );
    throw Error(`Provider did not return quote for ticker: ${tickerName} -> ${coinProviderId} - ${currency}`);
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
  const coinsList = await getAllCoinsList();
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

const getAllCoinsList = async () => {
  const cacheKey = "CoinsListCacheKey";
  const data = await RedisClient.get(cacheKey).catch((error) => {
    logger.error(`ERROR fetching coins list from cache`);
    Bugsnag.notify(error);
  });

  if (data) {
    logger.info(
      `Retrieving coins list from cache`
    );
    return JSON.parse(data);
  } else {
    return await CoingeckoGateway.executeRateLimitedRequest(CoingeckoGateway.getCoinsList);
  }
}

const getCoin = async (coinSymbol) => {
  const coinsList = await getAllCoinsList();
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
