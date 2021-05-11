
const newrelic = require('newrelic');
require("dotenv").config();
const Coin = require("../models/coin");
const Currency = require("../models/currency");
const { getSimplePrice } = require("../gateways/coingecko-gateway");
/* Values are hard-coded for this example, it's usually best to bring these in via file or environment variable for production */
redisClient = require("../gateways/redis-gateway")
const { log } = require('../utils/logger');
const Bugsnag = require('@bugsnag/js');
const {
  OPERATIONAL_LOG_TYPE, ERROR_SEVERITY, BUSINESS_LOG_TYPE
} = require('../utils/constants');

const get = async (req, res, next) => {
  let device_mac_address = req.headers['device-mac-address']
  newrelic.addCustomAttribute('device_mac_address', req.headers['device-mac-address'])
  let ticker_name = req.query.name
  newrelic.addCustomAttribute('ticker_name', ticker_name)

  let cached_result = await redisClient.get(ticker_name).catch((error) => {
    log({
      message: `ERROR fetching cache: ${error.stack}, ticker_name: ${ticker_name}, device_mac_address: ${device_mac_address}`,
      type: OPERATIONAL_LOG_TYPE,
      transactional: false,
      severity: ERROR_SEVERITY,
      ticker_name,
      device_mac_address,
      error
    });
    Bugsnag.notify(error);
  })

  if (cached_result) {
    newrelic.addCustomAttribute('cached', true)
    log({
      message: `sent result: ${cached_result} from cache`, type: BUSINESS_LOG_TYPE, transactional: false, ticker_name, device_mac_address
    });
    res.send(cached_result)
    return
  }

  newrelic.addCustomAttribute('cached', false)
  let ticker_array = ticker_name.split(":")

  if (ticker_array.length !== 2) {
    log({
      message: `invalid ticker`, type: BUSINESS_LOG_TYPE, transactional: false, ticker_name, device_mac_address, severity: ERROR_SEVERITY
    });
    let error = new Error(`Invalid ticker: ${ticker_name}, device_mac_address:${device_mac_address}`)
    Bugsnag.notify(error);
    newrelic.noticeError(error)
    res.send("Invalid Ticker")
    return
  }

  let coin = await Coin.findOne({ base: ticker_array[0] })

  let currency = await Currency.findOne({ name: ticker_array[1] })

  if (!coin || !currency) {
    log({
      message: `Unsupported Ticker`, type: BUSINESS_LOG_TYPE, transactional: false, ticker_name, device_mac_address, severity: ERROR_SEVERITY
    });
    let error = new Error(`Unsupported Ticker: ${ticker_name}, device_mac_address:${device_mac_address}`)
    Bugsnag.notify(error);
    newrelic.noticeError(error)
    res.status(200).send("Unsupported")
    return
  }

  try {
    let currency_name = currency.name.toLowerCase()
    let result = await getSimplePrice(coin.base_id, currency_name)
    let object = result.data[coin.base_id]
    if (!object) {
      log({
        message: `Removed ticker`, type: BUSINESS_LOG_TYPE, transactional: false, ticker_name, device_mac_address, severity: ERROR_SEVERITY
      });
      let error = new Error(`Removed Ticker: ${ticker_name}, device_mac_address:${device_mac_address}`)
      Bugsnag.notify(error);
      newrelic.noticeError(error)
      res.status(200).send("Removed")
      return
    } else {
      let change24h = Math.round(Number(object[`${currency_name}_24h_change`]) * 100) / 100
      let result = `${object[currency_name]};${change24h}`
      redisClient.set(ticker_name, result).catch((error) => {
        log({
          message: `ERROR saving cache: ${error.stack}, ticker_name: ${ticker_name}, device_mac_address:${device_mac_address}`, type: BUSINESS_LOG_TYPE, transactional: false, ticker_name, device_mac_address, severity: ERROR_SEVERITY
        });
        Bugsnag.notify(error);
      })
      let expireTTL = process.env.REDIS_TICKER_MARKET_TTL || 5
      log({
        message: `Setting Ticker ${ticker_name}, device_mac_address: ${device_mac_address} to expire in ${expireTTL}`, type: BUSINESS_LOG_TYPE, transactional: false, ticker_name, device_mac_address
      });
      redisClient.expire(ticker_name, expireTTL)
      log({
        message: `sent result: ${cached_result} from api`, type: BUSINESS_LOG_TYPE, transactional: false, ticker_name, device_mac_address
      });
      res.send(result)
    }
  } catch (error) {
    log({
      message: `UNKNOWN ERROR: ${error.stack}, ticker_name: ${ticker_name} device_mac_address: ${device_mac_address}`, type: OPERATIONAL_LOG_TYPE, transactional: false, ticker_name, device_mac_address, severity: ERROR_SEVERITY, error
    });
    Bugsnag.notify(error);
    newrelic.noticeError(error)
    res.status(500).send("Upstream Error")
    return
  }
}

const getTickers = async (req, res, next) => {
  try {
    newrelic.addCustomAttribute('device_mac_address', req.headers['device-mac-address'])
    let page = !!req.query.page ? req.query.page : 1
    let limit = 250

    let coins = await Coin.find({ active: true })
    let currency = await Currency.find({ active: true })

    const startIndex = (page - 1) * limit
    const endIndex = page * limit

    res.json({ coins: { data: (coins.map(x => x.base).slice(startIndex, endIndex)), total: coins.length }, currencies: currency.map(x => x.name) })
  } catch (error) {
    log({
      message: `UNKNOWN ERROR: ${error.stack}, ticker_name: ${ticker_name} device_mac_address: ${device_mac_address}`, type: OPERATIONAL_LOG_TYPE, transactional: false, ticker_name, device_mac_address, severity: ERROR_SEVERITY, error
    });
    Bugsnag.notify(error);
    newrelic.noticeError(error)
    res.status(500).send("Upstream Error")
  }
}

const getCoin = async (req, res, next) => {
  console.log("here")
  try {
    let coin_requested = req.param.coin && req.param.coin.toLowerCase()
    newrelic.addCustomAttribute('device_mac_address', req.headers['device-mac-address'])
    newrelic.addCustomAttribute('coin', coin_requested)

    let coin = await Coin.findOne({ base_id: coin_requested, active: true })

    if (!!coin) {
      res.json(coin)
    } else {
      res.status(404).send("Coin does not exist")
    }

  } catch (error) {
    log({
      message: `UNKNOWN ERROR: ${error.stack}, ticker_name: ${ticker_name} device_mac_address: ${device_mac_address}`, type: OPERATIONAL_LOG_TYPE, transactional: false, ticker_name, device_mac_address, severity: ERROR_SEVERITY, error
    });
    Bugsnag.notify(error);
    newrelic.noticeError(error)
    res.status(500).send("Upstream Error")
  }
}

module.exports = { get, getTickers, getCoin };
