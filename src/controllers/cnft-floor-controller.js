const newrelic = require("newrelic");
const Bugsnag = require("@bugsnag/js");

const OpencnftGateway = require("../gateways/opencnft-gateway");
const RedisClient = require("../gateways/redis-gateway");
const { getLogger } = require("../utils/logger");

const logger = getLogger();
const TOP_CNFT_PROJECTS_REDIS_KEY = "CRYPTO:TOP_CNFT_PROJECTS_REDIS_KEY";

const getFloorPriceByPolicy = async (req, res) => {
  addNewRelicCustomAttributes(req);
  const cnftPolicy = req.params.policy;

  let cached_result = await RedisClient.get(cnftPolicy).catch((error) => {
    logger.error(
      `ERROR fetching cache: ${error.stack}, cnftPolicy: ${cnftPolicy}`
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
    const result = await OpencnftGateway.getFloorPrice(cnftPolicy);
    const floorPrice = Number(result.data["floor_price"]) / 1000000;
    RedisClient.set(cnftPolicy, floorPrice).catch((error) => {
      logger.error(
        `ERROR saving cache: ${error.stack}, cnftPolicy: ${cnftPolicy}`
      );
      Bugsnag.notify(error);
    });
    let expireTTL = process.env.REDIS_TICKER_MARKET_TTL || 5;
    logger.info(`Setting floor price ${cnftPolicy}`);
    RedisClient.expire(cnftPolicy, expireTTL);
    logger.info(`sent result: ${floorPrice.toString()} from api`);
    res.send(floorPrice.toString());
  } catch (error) {
    logger.error(`UNKNOWN ERROR: ${error.stack}, cnftPolicy: ${cnftPolicy}`);
    Bugsnag.notify(error);
    newrelic.noticeError(error);
    res.status(500).send("Upstream Error");
    return;
  }
};

const getTopProjects = async (_, res) => {
  let cachedResult = await RedisClient.get(TOP_CNFT_PROJECTS_REDIS_KEY).catch(
    (error) => {
      logger.error(
        `ERROR fetching cache: ${error.stack}, CRYPTO:TOP_CNFT_PROJECTS_REDIS_KEY`
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

    RedisClient.set(
      TOP_CNFT_PROJECTS_REDIS_KEY,
      JSON.stringify(ranking10)
    ).catch((error) => {
      logger.error(
        `ERROR setting CRYPTO:TOP_CNFT_PROJECTS_REDIS_KEY cache: ${error.stack}`
      );
      Bugsnag.notify(error);
    });
    let expireTTL = process.env.REDIS_TICKER_MARKET_TTL || 5;
    RedisClient.expire(TOP_CNFT_PROJECTS_REDIS_KEY, expireTTL);
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
