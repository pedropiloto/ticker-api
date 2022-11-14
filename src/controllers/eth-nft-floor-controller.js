const newrelic = require("newrelic");
const Bugsnag = require("@bugsnag/js");
const pino = require("pino");

const redisClient = require("../gateways/redis-gateway");
const OpenseaGateway = require("../gateways/opensea-gateway");

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  prettyPrint: { colorize: true },
});

const NFT_ETH_TOP_PROJECTS_REDIS_KEY = "NFT_ETH_TOP_PROJECTS_REDIS_KEY";

// eslint-disable-next-line no-unused-vars
const getTopProjects = async (req, res, next) => {
  let cachedResult = await redisClient
    .get(NFT_ETH_TOP_PROJECTS_REDIS_KEY)
    .catch((error) => {
      logger.error(
        `ERROR fetching NFT_ETH_TOP_PROJECTS_REDIS_KEY cache: ${error.stack}`
      );
      Bugsnag.notify(error);
    });

  if (cachedResult) {
    newrelic.addCustomAttribute("cached", true);
    res.json(JSON.parse(cachedResult));
  } else {
    res.status(500).send("Upstream Error");
  }
};

// eslint-disable-next-line no-unused-vars
const updateTopProjects = async (req, res, next) => {
  try {
    const result = await OpenseaGateway.getTopProjects();
    const rankings = result.map((x) => {
      return { name: x["name"], slug: x["slug"] };
    });
    redisClient
      .set(NFT_ETH_TOP_PROJECTS_REDIS_KEY, JSON.stringify(rankings))
      .catch((error) => {
        logger.error(
          `ERROR saving NFT_ETH_TOP_PROJECTS_REDIS_KEY cache: ${error.stack}`
        );
        Bugsnag.notify(error);
      });
    res.json(rankings);
  } catch (error) {
    logger.error(`UNKNOWN ERROR: ${error.stack} `);
    Bugsnag.notify(error);
    newrelic.noticeError(error);
    res.status(500).send("Upstream Error");
    return;
  }
};

// eslint-disable-next-line no-unused-vars
const getFloorPriceBySlug = async (req, res, next) => {
  addNewRelicCustomAttributes(req);
  const ethProject = req.params.slug;
  const ethProjectCacheKey = `ETH:${ethProject}`;

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
    logger.info(`sent result: ${cachedResult} from cache`);
    res.send(cachedResult);
    return;
  }

  try {
    const result = await OpenseaGateway.getCollectionDetailsBySlug(ethProject);
    const floorPrice = result.data["collection"]["stats"]["floor_price"];
    redisClient.set(ethProjectCacheKey, floorPrice).catch((error) => {
      logger.error(
        `ERROR saving cache: ${error.stack}, ethProject: ${ethProject}`
      );
      Bugsnag.notify(error);
    });
    let expireTTL = process.env.REDIS_TICKER_MARKET_TTL || 5;
    logger.info(`Setting floor price ${ethProject} to expire in ${expireTTL}`);
    redisClient.expire(ethProject, expireTTL);
    logger.info(`sent result: ${floorPrice.toString()} from api`);
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
    req.headers["device-model"] || "MULTI_CNFT"
  );
  newrelic.addCustomAttribute(
    "device_version",
    req.headers["device-version"] || "1.0.0"
  );
  newrelic.addCustomAttribute("ethProject", req.params.slug);
};

module.exports = { getTopProjects, updateTopProjects, getFloorPriceBySlug };
