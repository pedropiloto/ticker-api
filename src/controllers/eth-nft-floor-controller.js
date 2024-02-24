const newrelic = require("newrelic");
const Bugsnag = require("@bugsnag/js");

const redisClient = require("../gateways/redis-gateway");
const CoingeckoGateway = require("../gateways/coingecko-gateway");
const { getLogger } = require("../utils/logger");

const logger = getLogger();

const NFT_ETH_TOP_PROJECTS_REDIS_KEY =
  "CRYPTO:NFT_ETH_TOP_ETH_NFT_PROJECTS_REDIS_KEY";

const getTopProjects = async (req, res) => {
  addNewRelicCustomAttributes(req);

  let cachedResult = await redisClient
    .get(NFT_ETH_TOP_PROJECTS_REDIS_KEY)
    .catch((error) => {
      logger.error(
        `ERROR fetching cache: ${error.stack}, top ethereum nft projects`
      );
      Bugsnag.notify(error);
    });

  newrelic.addCustomAttribute("cached", cachedResult);

  if (cachedResult) {
    res.json(JSON.parse(cachedResult));
    return;
  }

  try {
    const result = await CoingeckoGateway.executeRateLimitedRequest(CoingeckoGateway.getTopNFTProjects, "ethereum");

    const rankings = result.data.map((x) => {
      return { name: x["name"], slug: x["id"] };
    });

    redisClient
      .set(NFT_ETH_TOP_PROJECTS_REDIS_KEY, JSON.stringify(rankings))
      .catch((error) => {
        logger.error(
          `ERROR saving cache: ${error.stack}, top ethereum nft projects`
        );
        Bugsnag.notify(error);
      });
    let expireTTL = process.env.REDIS_NFT_ETH_PROJECTS_LIST || 86400;
    redisClient.expire(NFT_ETH_TOP_PROJECTS_REDIS_KEY, expireTTL);
    res.json(rankings);
  } catch (error) {
    logger.error(`UNKNOWN ERROR: ${error.stack}, top ethereum nft projects`);
    Bugsnag.notify(error);
    newrelic.noticeError(error);
    res.status(500).send("Upstream Error");
    return;
  }
};

const getFloorPriceBySlug = async (req, res) => {
  addNewRelicCustomAttributes(req);
  const ethProject = req.params.slug;
  const ethProjectCacheKey = `CRYPTO:ETH:${ethProject}`;

  let cachedResult = await redisClient
    .get(ethProjectCacheKey)
    .catch((error) => {
      logger.error(
        `ERROR fetching cache: ${error.stack}, ethProject: ${ethProject}`
      );
      Bugsnag.notify(error);
    });

  newrelic.addCustomAttribute("cached", cachedResult);

  if (cachedResult) {
    res.send(cachedResult);
    return;
  }

  try {
    const result = await CoingeckoGateway.executeRateLimitedRequest(CoingeckoGateway.getNFTProjectFloorPrice, ethProject);
    const floorPrice = result.data["floor_price"]["native_currency"];
    redisClient.set(ethProjectCacheKey, floorPrice).catch((error) => {
      logger.error(
        `ERROR saving cache: ${error.stack}, ethProject: ${ethProject}`
      );
      Bugsnag.notify(error);
    });
    let expireTTL = process.env.REDIS_TICKER_MARKET_TTL || 5;
    logger.info(`Setting floor price ${ethProject} to expire in ${expireTTL}`);
    redisClient.expire(ethProject, expireTTL);
    res.send(floorPrice.toString());
  } catch (error) {
    logger.error(`UNKNOWN ERROR: ${error.stack}, ethProject: ${ethProject}`);
    Bugsnag.notify(error);
    newrelic.noticeError(error);
    res.status(500).send("Upstream Error");
    return;
  }
};

const addNewRelicCustomAttributes = (req) => {
  newrelic.addCustomAttribute(
    "device_mac_address",
    req.headers["device-mac-address"]
  );
  newrelic.addCustomAttribute(
    "device_model",
    req.headers["device-model"] || "MULTI_ETH"
  );
  newrelic.addCustomAttribute(
    "device_version",
    req.headers["device-version"] || "1.0.0"
  );
  newrelic.addCustomAttribute("ethProject", req.params.slug);
};

module.exports = { getTopProjects, getFloorPriceBySlug };
