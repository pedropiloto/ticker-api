const redis = require("redis");
const Bugsnag = require("@bugsnag/js");
const { getLogger } = require("../utils/logger");

const logger = getLogger();

const client = redis
  .createClient({ url: process.env.REDIS_CONNECTION_STRING_URL })
  .on("error", (error) => {
    logger.error(`ERROR connecting to Redis: ${error}`);
    Bugsnag.notify(error);
  })
  .on("connect", () => {
    logger.info("Redis client connected");
  });

client.connect();

module.exports = client;
