const newrelic = require("newrelic");
const Bugsnag = require("@bugsnag/js");
const axios = require("axios");
const HttpsProxyAgent = require("https-proxy-agent");

const RedisClient = require("../gateways/redis-gateway");
const { getLogger } = require("../utils/logger");

const COINGECKO_USE_PROXY_KEY = "COINGECKO_USE_PROXY_KEY";
const COINGECKO_USE_PROXY_KEY_TTL = 600;
const COINGECKO_RATE_LIMIT_REQUESTS_KEY = "COINGECKO_RATE_LIMIT_REQUESTS_KEY";
const COINGECKO_RATE_LIMIT_REQUESTS_TTL = 65;
const COINGECKO_RATE_LIMIT_MAX_REQUESTS = 20;

const logger = getLogger();

const lock = require("redis-lock")(RedisClient);

const getCoinsList = async (forceRequestProxy = false) => {
  const cacheKey = "CoinsListCacheKey";
  let data;

  try {
    const proxy = await getProxy(forceRequestProxy);
    const config = {
      method: "get",
      url: "https://api.coingecko.com/api/v3/coins/list",
    };

    if (proxy) {
      const proxyAgent = new HttpsProxyAgent(proxy);
      config["proxy"] = false;
      config["httpsAgent"] = proxyAgent;
      logger.info(
        `Adding proxy to coingecko request`
      );
    }

    data = (
      await axios(config)
        .then(async (result) => {
          // evaluateRequestTurnOffProxy(!!proxy);
          return result;
        })
        .catch(async (error) => {
          // if (error && error.response && error.response.status && error.response.status === 429) {
          await evaluateRequestTurnOnProxy(!!proxy);
          // }
          throw error;
        })
    ).data;

    try {
      RedisClient.set(cacheKey, JSON.stringify(data));
      RedisClient.expire(cacheKey, 60 * 60 * 24 * 7);
    } catch (error) {
      logger.error(`ERROR saving coins list in cache: ${error.stack}`);
      Bugsnag.notify(error);
    }
  } catch (error) {
    logger.error(`ERROR retrieving coins list from coingecko ${error.stack}`);
  }
  return data;

};

const getSupportedCurrencies = async (forceRequestProxy = false) => {
  const cacheKey = "CurrenciesListCacheKey";
  let data;

  data = await RedisClient.get(cacheKey).catch((error) => {
    logger.error(`ERROR fetching currencies list from cache`);
    Bugsnag.notify(error);
  });

  if (data) {
    return JSON.parse(data);
  }

  const proxy = await getProxy(forceRequestProxy);
  const config = {
    method: "get",
    url: "https://api.coingecko.com/api/v3/simple/supported_vs_currencies",
  }

  if (proxy) {
    const proxyAgent = new HttpsProxyAgent(proxy);
    config["proxy"] = false;
    config["httpsAgent"] = proxyAgent;
    logger.info(
      `Adding proxy to coingecko request`
    );
  }

  data = (
    await axios(config)
      .then(async (result) => {
        // evaluateRequestTurnOffProxy(!!proxy);
        return result;
      })
      .catch(async (error) => {
        await evaluateRequestTurnOnProxy(!!proxy);
        throw error
      })
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

const getSimplePrice = async (coin, currency, forceRequestProxy = false) => {
  const proxy = await getProxy(forceRequestProxy);
  const config = {
    method: "get",
    url: `https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=${currency}&include_24hr_change=true`,
  };

  if (proxy) {
    const proxyAgent = new HttpsProxyAgent(proxy);
    config["proxy"] = false;
    config["httpsAgent"] = proxyAgent;
    logger.info(
      `Adding proxy to coingecko request`
    );
  }
  return axios(config)
    .then(async (result) => {
      // evaluateRequestTurnOffProxy(!!proxy);
      return result;
    })
    .catch(async (error) => {
      await evaluateRequestTurnOnProxy(!!proxy);
      throw error;
    });
};

const getCoinsMarket = async (page, forceRequestProxy = false) => {
  const proxy = await getProxy(forceRequestProxy);
  const config = {
    method: "get",
    url: `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&price_change_percentage=24h&order=market_cap_desc&per_page=250&page=${page}`,
  }
  if (proxy) {
    const proxyAgent = new HttpsProxyAgent(proxy);
    config["proxy"] = false;
    config["httpsAgent"] = proxyAgent;
    logger.info(
      `Adding proxy to coingecko request: ${page}`
    );
  }
  return axios(config)
    .then(async (result) => {
      // evaluateRequestTurnOffProxy(proxy);
      return result;
    })
    .catch(async (error) => {
      await evaluateRequestTurnOnProxy(proxy);
      throw error
    });
};

const getTopNFTProjects = async (chain, forceRequestProxy = false) => {
  const proxy = await getProxy(forceRequestProxy);
  const config = {
    method: "get",
    url: `https://api.coingecko.com/api/v3/nfts/list?order=h24_volume_native_desc&asset_platform_id=${chain}`,
  };

  if (proxy) {
    const proxyAgent = new HttpsProxyAgent(proxy);
    config["proxy"] = false;
    config["httpsAgent"] = proxyAgent;
  }
  return axios(config)
    .then(async (result) => {
      // evaluateRequestTurnOffProxy(!!proxy);
      return result;
    })
    .catch(async (error) => {
      await evaluateRequestTurnOnProxy(!!proxy);
      throw error
    })
};

const getNFTProjectFloorPrice = async (slug, forceRequestProxy = false) => {
  const proxy = getProxy(forceRequestProxy);
  const config = {
    method: "get",
    url: `https://api.coingecko.com/api/v3/nfts/${slug}`,
  };

  if (proxy) {
    const proxyAgent = new HttpsProxyAgent(proxy);
    config["proxy"] = false;
    config["httpsAgent"] = proxyAgent;
  }
  return axios(config)
    .then(async (result) => {
      // evaluateRequestTurnOffProxy(!!proxy);
      return result;
    })
    .catch(async (error) => {
      await evaluateRequestTurnOnProxy(!!proxy);
      throw error
    });
};

const executeRateLimitedRequest = async (func, ...args) => {
  const done = await lock("coingeckoRequest");
  setTimeout(done, 2500);
  let requestsOngoing;
  try {
    requestsOngoing = Number(await RedisClient.get(COINGECKO_RATE_LIMIT_REQUESTS_KEY).catch((_) => { return 0 }));
    if (!requestsOngoing) {
      requestsOngoing = 0;
    }
  } catch (error) {
    logger.error(`Error when retrieving coingecko ongoing requests: ${error.stack}.`);
    requestsOngoing = 0
  }
  logger.info(`Evaluating coingecko ongoing requests: ${requestsOngoing}`);
  if (requestsOngoing < COINGECKO_RATE_LIMIT_MAX_REQUESTS) {
    logger.info(`Allowing non proxy coingecko request. Coingecko ongoing requests: ${requestsOngoing}`);
    const currentTTL = await RedisClient.ttl(COINGECKO_RATE_LIMIT_REQUESTS_KEY).catch((_) => { return 0 })
    RedisClient.set(COINGECKO_RATE_LIMIT_REQUESTS_KEY, requestsOngoing + 1).catch((_) => { });
    if (currentTTL <= 0) {
      logger.info(`Resetting coingecko ongoing requests TTL to ${COINGECKO_RATE_LIMIT_REQUESTS_TTL} seconds.`);
      RedisClient.expire(COINGECKO_RATE_LIMIT_REQUESTS_KEY, COINGECKO_RATE_LIMIT_REQUESTS_TTL);
    } else {
      RedisClient.expire(COINGECKO_RATE_LIMIT_REQUESTS_KEY, currentTTL);
    }
  } else {
    logger.info(`Not allowing non proxy coingecko request. Coingecko ongoing requests: ${requestsOngoing}`);
    args.push(true);
  }
  try {
    return await func(...args);
  } finally {
    await done()
  }
};

const evaluateRequestTurnOffProxy = (isProxyRequest) => {
  logger.info('Called evaluateRequestTurnOffProxy', { isProxyRequest });
  if (!isProxyRequest) {
    logger.info('Turning OFF PROXY for coingecko');
    RedisClient.set(COINGECKO_USE_PROXY_KEY, "false").catch((_) => { });
  }
};

const evaluateRequestTurnOnProxy = async (isProxyRequest) => {
  logger.info('Called evaluateRequestTurnOnProxy', { isProxyRequest });
  if (!isProxyRequest) {
    logger.info(`Turning ON proxy for coingecko during 60 seconds`);
    RedisClient.set(COINGECKO_RATE_LIMIT_REQUESTS_KEY, COINGECKO_RATE_LIMIT_MAX_REQUESTS).catch((_) => { });
    RedisClient.expire(COINGECKO_RATE_LIMIT_REQUESTS_KEY, 60);
  }
};

const getProxy = async (forceRequestProxy = false) => {
  const proxy = process.env.PROXY;
  const forceProxy = process.env.FORCE_PROXY;
  let proxyResult;
  if (!proxy) {
    newrelic.addCustomAttribute(
      "proxy", false
    )
    return undefined;
  }
  const systemUserProxyActivated = await RedisClient.get(COINGECKO_USE_PROXY_KEY).catch((_) => { });

  if (!!forceRequestProxy || forceProxy === "true" || systemUserProxyActivated === "true") {
    proxyResult = proxy;
  }
  newrelic.addCustomAttribute(
    "proxy", proxyResult === undefined ? false : true
  )
  return proxyResult;
}

module.exports = {
  getCoinsList,
  getSupportedCurrencies,
  getSimplePrice,
  getCoinsMarket,
  getTopNFTProjects,
  getNFTProjectFloorPrice,
  executeRateLimitedRequest,
  COINGECKO_USE_PROXY_KEY,
  COINGECKO_USE_PROXY_KEY_TTL
};
