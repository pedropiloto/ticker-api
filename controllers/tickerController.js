
const newrelic = require('newrelic');
require("dotenv").config();
const Coin = require("../models/coin");
const Currency = require("../models/currency");
const { getSimplePrice } = require("../gateways/coingecko-gateway");
/* Values are hard-coded for this example, it's usually best to bring these in via file or environment variable for production */
redisClient = require("../gateways/redis-gateway")

const get = async (req, res, next) => {
  newrelic.addCustomAttribute('device_mac_address', req.headers['device_mac_address'])
  let ticker_name = req.query.name
  newrelic.addCustomAttribute('ticker_name', ticker_name)

  let cached_result = await redisClient.get(ticker_name).catch((e)=>{
    console.log("ERROR fetching cache", e, e.stack)
  })

  if (cached_result) {
  newrelic.addCustomAttribute('cached', true)
    console.log("from cache")
    res.send(cached_result)
    return
  }

  newrelic.addCustomAttribute('cached', false)
  console.log("from api")
  let ticker_array = ticker_name.split(":")

  if (ticker_array.length !== 2) {
    res.send("Invalid Ticker")
    return
  }

    let coin = await Coin.findOne({ base: ticker_array[0] })

    let currency = await Currency.findOne({ name: ticker_array[1] })

    if (!coin || !currency) {
      res.status(200).send("Invalid")
      return
    }

  try {
    let currency_name = currency.name.toLowerCase()
    let result = await getSimplePrice(coin.base_id, currency_name)
    let object = result.data[coin.base_id]
    if (!object) {
      res.status(200).send("Removed")
      return
    } else {
      let change24h = Math.round(Number(object[`${currency_name}_24h_change`]) * 100) / 100
      let result = `${object[currency_name]};${change24h}`
      redisClient.set(ticker_name, result).catch((e)=>{
        console.log("ERROR saving cache", e, e.stack)
      })

      console.log("REDIS_TICKER_MARKET_TTL =",process.env.REDIS_TICKER_MARKET_TTL)
      redisClient.expire(ticker_name, process.env.REDIS_TICKER_MARKET_TTL || 5)
      res.send(result)
    }
  } catch (error) {
    console.log("failed", error, error.stack)
    res.status(500).send("Upstream Error")
    return
  }
}

const getTickers = async (req, res, next) => {
  newrelic.addCustomAttribute('device_mac_address', req.headers['device_mac_address'])
  let page = !!req.query.page ? req.query.page : 1
  let limit = 250

  let coins = await Coin.find({ active: true })
  let currency = await Currency.find({ active: true })

  const startIndex = (page - 1) * limit
  const endIndex = page * limit

  res.json({ coins: { data: (coins.map(x => x.base).slice(startIndex, endIndex)), total: coins.length }, currencies: currency.map(x => x.name) })
}

module.exports = { get, getTickers };
