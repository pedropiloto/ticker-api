
const newrelic = require('newrelic');
require("dotenv").config();
const OpencnftGateway = require("../gateways/opencnft-gateway");
/* Values are hard-coded for this example, it's usually best to bring these in via file or environment variable for production */
redisClient = require("../gateways/redis-gateway")
const { log } = require('../utils/logger');
const Bugsnag = require('@bugsnag/js');
const {
  OPERATIONAL_LOG_TYPE, ERROR_SEVERITY, BUSINESS_LOG_TYPE
} = require('../utils/constants');

const getFloorPriceByPolicy = async (req, res, next) => {
  let device_mac_address = req.headers['device-mac-address']
  newrelic.addCustomAttribute('device_mac_address', req.headers['device-mac-address'])
  newrelic.addCustomAttribute('device_model', req.headers['device-model'] || "MULTI_CNFT")
  newrelic.addCustomAttribute('device_version', req.headers['device-version'] || "1.0.0")
  let cnft_policy = req.params.policy
  newrelic.addCustomAttribute('cnft_project', cnft_policy)

  let cached_result = await redisClient.get(cnft_policy).catch((error) => {
    log({
      message: `ERROR fetching cache: ${error.stack}, cnft_policy: ${cnft_policy}, device_mac_address: ${device_mac_address}`,
      type: OPERATIONAL_LOG_TYPE,
      transactional: false,
      severity: ERROR_SEVERITY,
      cnft_policy,
      device_mac_address,
      error
    });
    Bugsnag.notify(error);
  })

  if (cached_result) {
    newrelic.addCustomAttribute('cached', true)
    log({
      message: `sent result: ${cached_result} from cache`, type: BUSINESS_LOG_TYPE, transactional: false, cnft_policy, device_mac_address
    });
    res.send(cached_result)
    return
  }

  newrelic.addCustomAttribute('cached', false)

  try {
    const result = await OpencnftGateway.getFloorPrice(cnft_policy)
    const floor_price = Number(result.data['floor_price']) / 1000000
    redisClient.set(cnft_policy, floor_price).catch((error) => {
      log({
        message: `ERROR saving cache: ${error.stack}, cnft_policy: ${cnft_policy}, device_mac_address:${device_mac_address}`, type: BUSINESS_LOG_TYPE, transactional: false, cnft_policy, device_mac_address, severity: ERROR_SEVERITY
      });
      Bugsnag.notify(error);
    })
    let expireTTL = process.env.REDIS_TICKER_MARKET_TTL || 5
    log({
      message: `Setting floor price ${cnft_policy}, device_mac_address: ${device_mac_address} to expire in ${expireTTL}`, type: BUSINESS_LOG_TYPE, transactional: false, cnft_policy, device_mac_address
    });
    redisClient.expire(cnft_policy, expireTTL)
    log({
      message: `sent result: ${result} from api`, type: BUSINESS_LOG_TYPE, transactional: false, cnft_policy, device_mac_address
    });
    console.log(floor_price)
    res.send(floor_price.toString())
  } catch (error) {
    log({
      message: `UNKNOWN ERROR: ${error.stack}, cnft_policy: ${cnft_policy} device_mac_address: ${device_mac_address}`, type: OPERATIONAL_LOG_TYPE, transactional: false, cnft_policy, device_mac_address, severity: ERROR_SEVERITY, error
    });
    Bugsnag.notify(error);
    newrelic.noticeError(error)
    res.status(500).send("Upstream Error")
    return
  }
}

const getTopProjects = async (req, res, next) => {

  const TOP_PROJECTS_REDIS_KEY = "TOP_PROJECTS_REDIS_KEY"

  let cached_result = await redisClient.get(TOP_PROJECTS_REDIS_KEY).catch((error) => {
    log({
      message: `ERROR fetching cache: ${error.stack}, TOP_PROJECTS_REDIS_KEY`,
      type: OPERATIONAL_LOG_TYPE,
      transactional: false,
      severity: ERROR_SEVERITY,
      error
    });
    Bugsnag.notify(error);
  })

  if (cached_result) {
    newrelic.addCustomAttribute('cached', true)
    res.json(JSON.parse(cached_result))
    return
  }

  newrelic.addCustomAttribute('cached', false)

  try {
    const result = await OpencnftGateway.getTopProjects()
    const ranking = result.data['ranking']


    const ranking_10 = ranking.slice(0, 10).map(x => { return { "name": x.name, "policy": x.policies[0] } })

      redisClient.set(TOP_PROJECTS_REDIS_KEY, JSON.stringify(ranking_10)).catch((error) => {
        log({
          message: `ERROR saving cache: ${error.stack}, TOP_PROJECTS_REDIS_KEY`, type: BUSINESS_LOG_TYPE, transactional: false, severity: ERROR_SEVERITY
        });
        Bugsnag.notify(error);
      })
      let expireTTL = process.env.REDIS_TICKER_MARKET_TTL || 5
      redisClient.expire(TOP_PROJECTS_REDIS_KEY, expireTTL)
    res.json(ranking_10)
  } catch (error) {
    log({
      message: `UNKNOWN ERROR: ${error.stack}, TOP_PROJECTS_REDIS_KEY`, type: OPERATIONAL_LOG_TYPE, transactional: false, severity: ERROR_SEVERITY, error
    });
    Bugsnag.notify(error);
    newrelic.noticeError(error)
    res.status(500).send("Upstream Error")
    return
  }
}

module.exports = { getFloorPriceByPolicy, getTopProjects };
