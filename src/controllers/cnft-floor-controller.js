const newrelic = require("newrelic");
const Bugsnag = require("@bugsnag/js");
const pino = require("pino");

const OpencnftGateway = require("../gateways/opencnft-gateway");
const RedisClient = require("../gateways/redis-gateway");

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  prettyPrint: { colorize: true },
});

// eslint-disable-next-line no-unused-vars
const getFloorPriceByPolicy = async (req, res, next) => {
  addNewRelicCustomAttributes(req);
  const CnftPolicy = req.params.policy;

  let cached_result = await RedisClient.get(CnftPolicy).catch((error) => {
    logger.error(
      `ERROR fetching cache: ${error.stack}, CnftPolicy: ${CnftPolicy}`
    );
    Bugsnag.notify(error);
  });

  if (cached_result) {
    newrelic.addCustomAttribute("cached", true);
    logger.info(`sent result: ${cached_result} from cache`);
    res.send(cached_result);
    return;
  }

  newrelic.addCustomAttribute("cached", false);

  try {
    const result = await OpencnftGateway.getFloorPrice(CnftPolicy);
    const floorPrice = Number(result.data["floor_price"]) / 1000000;
    RedisClient.set(CnftPolicy, floorPrice).catch((error) => {
      logger.error(
        `ERROR saving cache: ${error.stack}, CnftPolicy: ${CnftPolicy}`
      );
      Bugsnag.notify(error);
    });
    let expireTTL = process.env.REDIS_TICKER_MARKET_TTL || 5;
    logger.info(`Setting floor price ${CnftPolicy}`);
    RedisClient.expire(CnftPolicy, expireTTL);
    logger.info(`sent result: ${floorPrice.toString()} from api`);
    res.send(floorPrice.toString());
  } catch (error) {
    logger.error(`UNKNOWN ERROR: ${error.stack}, CnftPolicy: ${CnftPolicy}`);
    Bugsnag.notify(error);
    newrelic.noticeError(error);
    res.status(500).send("Upstream Error");
    return;
  }
};

// eslint-disable-next-line no-unused-vars
const getTopProjects = async (req, res, next) => {
  const TOP_PROJECTS_REDIS_KEY = "TOP_PROJECTS_REDIS_KEY";

  let cachedResult = await RedisClient.get(TOP_PROJECTS_REDIS_KEY).catch(
    (error) => {
      logger.error(
        `ERROR fetching cache: ${error.stack}, TOP_PROJECTS_REDIS_KEY`
      );
      Bugsnag.notify(error);
    }
  );

  newrelic.addCustomAttribute("cached", cachedResult);

  if (cachedResult) {
    res.json(JSON.parse(cachedResult));
    return;
  }

  try {
    const result = await OpencnftGateway.getTopProjects();
    const ranking = result.data["ranking"];

    const ranking10 = ranking.slice(0, 10).map((x) => {
      return { name: x.name, policy: x.policies[0] };
    });

    RedisClient.set(TOP_PROJECTS_REDIS_KEY, JSON.stringify(ranking10)).catch(
      (error) => {
        logger.error(
          `ERROR setting TOP_PROJECTS_REDIS_KEY cache: ${error.stack}`
        );
        Bugsnag.notify(error);
      }
    );
    let expireTTL = process.env.REDIS_TICKER_MARKET_TTL || 5;
    RedisClient.expire(TOP_PROJECTS_REDIS_KEY, expireTTL);
    res.json(ranking10);
  } catch (error) {
    logger.error(`UNKNOWN ERROR: ${error.stack}, `);
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
  newrelic.addCustomAttribute("cnft_project", req.params.policy);
};

module.exports = { getFloorPriceByPolicy, getTopProjects };
