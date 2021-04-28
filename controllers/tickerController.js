
require("dotenv").config();
const e = require("express");
const redis = require("redis");
const Coin = require("../models/coin");
const Currency = require("../models/currency");
const { getSimplePrice } = require("../gateways/coingecko-gateway");
/* Values are hard-coded for this example, it's usually best to bring these in via file or environment variable for production */
redisClient = require("../gateways/redis-gateway")

const get = async (req, res, next) => {
  let ticker_name = req.query.name

  redisClient.get(ticker_name, async (err, reply) => {
    if (err) {
      console.log("error retrieving from cache", err, err.stack)
      res.status("500").send("Retrieving From Cache Error")
      return
    }
    if (reply) {
      console.log("from cache")
      res.send(reply)
      return
    }

    console.log("from api")
    let ticker_array = ticker_name.split(":")

    if (ticker_array.length !== 2) {
      res.status(400).send("Invalid Ticker")
      return
    }

    let coin = await Coin.findOne({ base: ticker_array[0] })

    let currency = await Currency.findOne({ name: ticker_array[1] })

    if (!!coin && !!currency) {
      if (!coin.active || !currency.active) {
        res.status(200).send("Removed")
        return
      }
      try {
        let currency_name = currency.name.toLowerCase()
        let result = await getSimplePrice(coin.base_id, currency_name)
        let object = result.data[coin.base_id]
        if (!object) {
          res.status(404).send("Upstream did not find the ticker")
          return
        } else {
          let change24h = Math.round(Number(object[`${currency_name}_24h_change`]) * 100) / 100
          let result = `${object[currency_name]};${change24h}`
          redisClient.set(ticker_name, result)
          redisClient.expire(ticker_name, process.env.REDIS_TICKER_MARKET_TTL || 600)
          res.send(result)
        }
      } catch (error) {
        res.status(500).send("Upstream Error")
        return
      }

    } else {
      res.status(400).send("Invalid Ticker")
    }

  });
}

const getTickers = async (req, res, next) => {
  let coin = await Coin.find({ active: true })
  let currency = await Currency.find({ active: true })
  res.json({ coins: (coin.map(x => x.base).slice(0, 5)), currencies: currency.map(x => x.name) })
}

module.exports = { get, getTickers };
