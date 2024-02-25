const Bugsnag = require("@bugsnag/js");
const axios = require("axios");
const Bottleneck = require("bottleneck");
const HttpsProxyAgent = require("https-proxy-agent");

const RedisClient = require("../gateways/redis-gateway");
const { getLogger } = require("../utils/logger");

const COINGECKO_USE_PROXY_KEY = "COINGECKO_USE_PROXY_KEY";
const COINGECKO_USE_PROXY_KEY_TTL = 3600;
const COINGECKO_RATE_LIMIT_REQUESTS_KEY = "COINGECKO_RATE_LIMIT_REQUESTS_KEY";
const COINGECKO_RATE_LIMIT_REQUESTS_TTL = 65;
const COINGECKO_RATE_LIMIT_MAX_REQUESTS = 25;

const logger = getLogger();

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 5000, // pick a value that makes sense for your use case
});

const lock = require("redis-lock")(RedisClient);

const getCoinsList = async (forceRequestProxy = false) => {
  const cacheKey = "CoinsListCacheKey";
  let data;

  data = await RedisClient.get(cacheKey).catch((error) => {
    logger.error(`ERROR fetching coins list from cache`);
    Bugsnag.notify(error);
  });

  if (data) {
    logger.info(
      `Retrieving coins list from cache`
    );
    return JSON.parse(data);
  }

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
            evaluateRequestTurnOffProxy(!!proxy);
            return result;
          })
          .catch(async (error) => {
            await evaluateRequestTurnOnProxy(!!proxy);
            return error
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
          evaluateRequestTurnOffProxy(!!proxy);
          return result;
        })
        .catch(async (error) => {
          await evaluateRequestTurnOnProxy(!!proxy);
          return error
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
        evaluateRequestTurnOffProxy(!!proxy);
        return result;
      })
      .catch(async (error) => {
        logger.info(`Evaluating turn ON proxy: ${error}`);
        await evaluateRequestTurnOnProxy(!!proxy);
        return error
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
        evaluateRequestTurnOffProxy(!!proxy);
        return result;
      })
      .catch(async (error) => {
        await evaluateRequestTurnOnProxy(!!proxy);
        return error
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
      evaluateRequestTurnOffProxy(!!proxy);
      return result;
    })
    .catch(async (error) => {
      await evaluateRequestTurnOnProxy(!!proxy);
      return error
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
      evaluateRequestTurnOffProxy(!!proxy);
      return result;
    })
    .catch(async (error) => {
      await evaluateRequestTurnOnProxy(!!proxy);
      return error
    });
};

const executeRateLimitedRequest = async (func, ...args) => {
  const done = await lock("coingeckoRequest");
  setTimeout(done, 2000);
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
  await done()
  return func(...args)
};

const evaluateRequestTurnOffProxy = (isProxyRequest) => {
  if (!isProxyRequest) {
    logger.info('Turning OFF PROXY for coingecko');
    RedisClient.set(COINGECKO_USE_PROXY_KEY, "false").catch((_) => { });
  }
};

const evaluateRequestTurnOnProxy = async (isProxyRequest) => {
  if (!isProxyRequest) {
    logger.info('Turning ON PROXY for coingecko');
    if ((await RedisClient.get(COINGECKO_USE_PROXY_KEY).catch((_) => { })) !== "true") {
      RedisClient.set(COINGECKO_USE_PROXY_KEY, "true").catch((_) => { });
      RedisClient.expire(COINGECKO_USE_PROXY_KEY, COINGECKO_USE_PROXY_KEY_TTL);
    }
  }
};

const getProxy = async (forceRequestProxy = false) => {
  const proxy = process.env.PROXY;
  const forceProxy = process.env.FORCE_PROXY;
  if (!proxy) {
    return undefined;
  }
  const systemUserProxyActivated = await RedisClient.get(COINGECKO_USE_PROXY_KEY).catch((_) => { });

  if (!!forceRequestProxy || forceProxy === "true" || systemUserProxyActivated === "true") {
    return proxy
  };
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
