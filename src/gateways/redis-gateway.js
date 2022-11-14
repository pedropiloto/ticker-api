require("dotenv").config();
const redis = require("redis");
const { promisify } = require("util");
const Bugsnag = require("@bugsnag/js");
const pino = require("pino");

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  prettyPrint: { colorize: true },
});

const options = {
  port: process.env.REDIS_PORT,
  host: process.env.REDIS_URL,
};

if (process.env.REDIS_PASSWORD) {
  options["password"] = process.env.REDIS_PASSWORD;
}

const client = redis.createClient(options);

client.on("connect", () => {
  logger.info("Redis client connected");
});

client.on("error", (error) => {
  logger.error(`ERROR connecting to Redis: ${error}`);
  Bugsnag.notify(error);
});

const get = promisify(client.get).bind(client);
const set = promisify(client.set).bind(client);
const expire = promisify(client.expire).bind(client);

module.exports = {
  get,
  set,
  expire,
};
