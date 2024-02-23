const Bugsnag = require("@bugsnag/js");
const axios = require("axios");
const Bottleneck = require("bottleneck");
const HttpsProxyAgent = require("https-proxy-agent");

const RedisClient = require("../gateways/redis-gateway");
const { getLogger } = require("../utils/logger");

const COINGECKO_USE_PROXY_KEY = "COINGECKO_USE_PROXY_KEY";
const COINGECKO_USE_PROXY_KEY_TTL = 3600;

const logger = getLogger();

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
    logger.info(
      `Retrieving coins list from cache`
    );
    return JSON.parse(data);
  }

  try {

    const proxy = await getProxy();
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
      await limiter.wrap(() =>
        axios(config)
        .then(async (result) => {
          evaluateRequestTurnOffProxy(!!proxy);
          return result;
        })
        .catch(async (error) => {
          await evaluateRequestTurnOnProxy(!!proxy);
          return error
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
  } catch (error) {
    logger.error(`ERROR retrieving coins list from coingecko ${error.stack}`);
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

  const proxy = await getProxy();
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
    await limiter.wrap(() =>
      axios(config)
      .then(async (result) => {
        evaluateRequestTurnOffProxy(!!proxy);
        return result;
      })
      .catch(async (error) => {
        await evaluateRequestTurnOnProxy(!!proxy);
        return error
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
  const proxy = await getProxy();
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
  return limiter.wrap(() =>
    axios(config)
      .then(async (result) => {
        evaluateRequestTurnOffProxy(!!proxy);
        return result;
      })
      .catch(async (error) => {
        logger.info(`Evaluating turn ON proxy: ${error}`);
        await evaluateRequestTurnOnProxy(!!proxy);
        return error
      })
  )();
};

const getCoinsMarket = async (page) => {
  const proxy = await getProxy();
  const config = {
    method: "get",
    url: `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&price_change_percentage=24h&order=market_cap_desc&per_page=250&page=${page}`,
  }
  if (proxy) {
    const proxyAgent = new HttpsProxyAgent(proxy);
    config["proxy"] = false;
    config["httpsAgent"] = proxyAgent;
    logger.info(
      `Adding proxy to coingecko request: ${tickerName}`
    );
  }
  return limiter.wrap(() =>
    axios(config)
    .then(async (result) => {
      evaluateRequestTurnOffProxy(!!proxy);
      return result;
    })
    .catch(async (error) => {
      await evaluateRequestTurnOnProxy(!!proxy);
      return error
    })
  )();
};

const getTopNFTProjects = async (chain) => {
  const proxy = await getProxy();
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

const getNFTProjectFloorPrice = async (slug) => {
  const proxy = getProxy();
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

const getProxy = async () => {
  const proxy = process.env.PROXY;
  const forceProxy = process.env.FORCE_PROXY;
  if (!proxy) {
    return undefined;
  }
  const systemUserProxyActivated = await RedisClient.get(COINGECKO_USE_PROXY_KEY).catch((_) => { });

  if (forceProxy === "true" || systemUserProxyActivated === "true") {
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
  COINGECKO_USE_PROXY_KEY,
  COINGECKO_USE_PROXY_KEY_TTL
};
