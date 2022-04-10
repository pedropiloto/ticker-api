
const newrelic = require('newrelic');
require("dotenv").config();
const OpenseaGateway = require("../gateways/opensea-gateway");
/* Values are hard-coded for this example, it's usually best to bring these in via file or environment variable for production */
redisClient = require("../gateways/redis-gateway")
const { log } = require('../utils/logger');
const Bugsnag = require('@bugsnag/js');
const {
  OPERATIONAL_LOG_TYPE, ERROR_SEVERITY, BUSINESS_LOG_TYPE
} = require('../utils/constants');

const NFT_ETH_TOP_PROJECTS_REDIS_KEY = "NFT_ETH_TOP_PROJECTS_REDIS_KEY"

const getTopProjects = async (req, res, next) => {
  let cached_result = await redisClient.get(NFT_ETH_TOP_PROJECTS_REDIS_KEY).catch((error) => {
    log({
      message: `ERROR fetching cache: ${error.stack}, NFT_ETH_TOP_PROJECTS_REDIS_KEY`,
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
  }else{
    res.status(500).send("Upstream Error")
  }
}

const updateTopProjects = async (req, res, next) => {

  try {
  const result = await OpenseaGateway.getTopProjects()
  const rankings = result.map(x => { return { 'name': x['name'], 'slug': x['slug'] } })
  console.log(rankings)
  redisClient.set(NFT_ETH_TOP_PROJECTS_REDIS_KEY, JSON.stringify(rankings)).catch((error) => {
    log({
      message: `ERROR saving cache: ${error.stack}, NFT_ETH_TOP_PROJECTS_REDIS_KEY`, type: BUSINESS_LOG_TYPE, transactional: false, severity: ERROR_SEVERITY
    });
    Bugsnag.notify(error);
  })
  res.json(rankings)
  } catch (error) {
    log({
      message: `UNKNOWN ERROR: ${error.stack}, NFT_ETH_TOP_PROJECTS_REDIS_KEY`, type: OPERATIONAL_LOG_TYPE, transactional: false, severity: ERROR_SEVERITY, error
    });
    Bugsnag.notify(error);
    newrelic.noticeError(error)
    res.status(500).send("Upstream Error")
    return
  }
}

const getFloorPriceBySlug = async (req, res, next) => {
  let device_mac_address = req.headers['device-mac-address']
  newrelic.addCustomAttribute('device_mac_address', req.headers['device-mac-address'])
  newrelic.addCustomAttribute('device_model', req.headers['device-model'] || "MULTI_CNFT")
  newrelic.addCustomAttribute('device_version', req.headers['device-version'] || "1.0.0")
  let ethProject = req.params.slug
  let ethProjectCacheKey = `ETH:${ethProject}`
  newrelic.addCustomAttribute('ethProject', ethProject)

  let cached_result = await redisClient.get(ethProjectCacheKey).catch((error) => {
    log({
      message: `ERROR fetching cache: ${error.stack}, ethProject: ${ethProject}, device_mac_address: ${device_mac_address}`,
      type: OPERATIONAL_LOG_TYPE,
      transactional: false,
      severity: ERROR_SEVERITY,
      eth_project: ethProject,
      device_mac_address,
      error
    });
    Bugsnag.notify(error);
  })

  if (cached_result) {
    newrelic.addCustomAttribute('cached', true)
    log({
      message: `sent result: ${cached_result} from cache`, type: BUSINESS_LOG_TYPE, transactional: false, eth_project: ethProject, device_mac_address
    });
    res.send(cached_result)
    return
  }

  newrelic.addCustomAttribute('cached', false)

  try {
    const result = await OpenseaGateway.getCollectionDetailsBySlug(ethProject)
    const floor_price = result.data['collection']['stats']['floor_price']
    redisClient.set(ethProjectCacheKey, floor_price).catch((error) => {
      log({
        message: `ERROR saving cache: ${error.stack}, ethProject: ${ethProject}, device_mac_address:${device_mac_address}`, type: BUSINESS_LOG_TYPE, transactional: false, eth_project: ethProject, device_mac_address, severity: ERROR_SEVERITY
      });
      Bugsnag.notify(error);
    })
    let expireTTL = process.env.REDIS_TICKER_MARKET_TTL || 5
    log({
      message: `Setting floor price ${ethProject}, device_mac_address: ${device_mac_address} to expire in ${expireTTL}`, type: BUSINESS_LOG_TYPE, transactional: false, eth_project: ethProject, device_mac_address
    });
    redisClient.expire(ethProject, expireTTL)
    log({
      message: `sent result: ${result} from api`, type: BUSINESS_LOG_TYPE, transactional: false, eth_project: ethProject, device_mac_address
    });
    console.log(floor_price)
    res.send(floor_price.toString())
  } catch (error) {
    log({
      message: `UNKNOWN ERROR: ${error.stack}, ethProject: ${ethProject} device_mac_address: ${device_mac_address}`, type: OPERATIONAL_LOG_TYPE, transactional: false, eth_project: ethProject, device_mac_address, severity: ERROR_SEVERITY, error
    });
    Bugsnag.notify(error);
    newrelic.noticeError(error)
    res.status(500).send("Upstream Error")
    return
  }
}

module.exports = { getTopProjects, updateTopProjects, getFloorPriceBySlug };
