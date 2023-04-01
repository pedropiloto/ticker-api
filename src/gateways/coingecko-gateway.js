const Bugsnag = require("@bugsnag/js");
const axios = require("axios");
const Bottleneck = require("bottleneck");
const pino = require("pino");
const HttpsProxyAgent = require('https-proxy-agent')

const RedisClient = require("../gateways/redis-gateway");

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  prettyPrint: { colorize: true },
});

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 5000, // pick a value that makes sense for your use case
});

const getCoinsList = async () => {
  const cacheKey = "CoinsListCacheKey";
  let data;

  data = await RedisClient.get(cacheKey).catch((error) => {
    logger.error(`ERROR fetching coins list from cache`);
    Bugsnag.notify(error);
  });

  if (data) {
    return JSON.parse(data);
  }

  data = (
    await limiter.wrap(() =>
      axios({
        method: "get",
        url: "https://api.coingecko.com/api/v3/coins/list",
      })
    )()
  ).data;

  try {
    RedisClient.set(cacheKey, JSON.stringify(data));
    RedisClient.expire(cacheKey, 60 * 60 * 6);
  } catch (error) {
    logger.error(`ERROR saving coins list in cache: ${error.stack}`);
    Bugsnag.notify(error);
  }
  return data;
};

const getSupportedCurrencies = async () => {
  const cacheKey = "CurrenciesListCacheKey";
  let data;

  data = await RedisClient.get(cacheKey).catch((error) => {
    logger.error(`ERROR fetching currencies list from cache`);
    Bugsnag.notify(error);
  });

  if (data) {
    return JSON.parse(data);
  }

  data = (
    await limiter.wrap(() =>
      axios({
        method: "get",
        url: "https://api.coingecko.com/api/v3/simple/supported_vs_currencies",
      })
    )()
  ).data;
  try {
    RedisClient.set(cacheKey, JSON.stringify(data));
    RedisClient.expire(cacheKey, 60 * 60 * 6);
  } catch (error) {
    logger.error(`ERROR saving currencies list in cache: ${error.stack}`);
    Bugsnag.notify(error);
  }
  return data;
};

const getSimplePrice = async (coin, currency) => {
  const proxy = process.env.PROXY
  const hasProxy = !!proxy
  const config = {
    method: "get",
    url: `https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=${currency}&include_24hr_change=true`,
  }

  if (hasProxy) {
    console.log('Using proxy')
    const proxyAgent = new HttpsProxyAgent(proxy);
    config['proxy'] = false
    config['httpsAgent'] = proxyAgent
} else {
    console.log('Not using proxy')
}
return axios(config)
};

const getCoinsMarket = async (page) => {
  return limiter.wrap(() =>
    axios({
      method: "get",
      url: `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&price_change_percentage=24h&order=market_cap_desc&per_page=250&page=${page}`,
    })
  )();
};

module.exports = {
  getCoinsList,
  getSupportedCurrencies,
  getSimplePrice,
  getCoinsMarket,
};
