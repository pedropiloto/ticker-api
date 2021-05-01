require("dotenv").config();
const redis = require("redis");
const { promisify } = require("util");
const Bugsnag = require('@bugsnag/js');
const {
  OPERATIONAL_LOG_TYPE, ERROR_SEVERITY,
} = require('../utils/constants');
const { log } = require('../utils/logger');

options = {
  port: process.env.REDIS_PORT,
  host: process.env.REDIS_URL,
}

if(process.env.REDIS_PASSWORD){
  options['password'] = process.env.REDIS_PASSWORD
}

client = redis.createClient(options);

client.on('connect', () => {
  log({
    message: 'Redis client connected',
    type: OPERATIONAL_LOG_TYPE,
    transactional: false,
  });
});

client.on('error', error => {
  log({
    message: `ERROR connecting to Redis: ${error}`,
    type: OPERATIONAL_LOG_TYPE,
    transactional: false,
    severity: ERROR_SEVERITY,
  });
  Bugsnag.notify(util.inspect(error));
});

const get = promisify(client.get).bind(client);
const set = promisify(client.set).bind(client);
const expire = promisify(client.expire).bind(client);

module.exports = {
    get,
    set,
    expire
};