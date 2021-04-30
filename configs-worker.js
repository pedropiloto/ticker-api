require('newrelic');
const express = require("express");
const logger = require("morgan");
const { getCoinsList, getSupportedCurrencies, getCoinsMarket } = require("./gateways/coingecko-gateway");
const Coin = require("./models/coin");
const Currency = require("./models/currency");
const SUPPORTED_CURRENCIES = require("./supported-currencies");
const mongoose = require("./config/database"); //database configuration

const start = async () => {
  try {
    mongoose.connection.on(
      "error",
      console.error.bind(console, "MongoDB connection error:")
    );

    let coins = []

    console.log("start fetching coins")
    for (let i = 0; i < 4; i++) {
      let coins_response = await getCoinsMarket(i+1)
      coins = coins.concat(coins_response.data)
    }
    console.log("coins fetched:", coins.length)

    let supported_vs_currencies = await getSupportedCurrencies()

    let filtered_supported_currencies = SUPPORTED_CURRENCIES.filter(
      sc => supported_vs_currencies.data.find(svc => svc === sc)).map(x => x.toUpperCase())

    let tickers = coins.filter(x => !x.id.includes(":")).filter(x => !x.id.includes(";")).map(
      x => {
        return {
          base_id: x.id,
          base: x.symbol.toUpperCase(),
        }
      }
    )

    let upsertOptions = { upsert: true, new: true, setDefaultsOnInsert: true }

    //insert coins
    let insertCoinsPromises = []
    tickers.forEach(element => {
      let query = { base_id: element.base_id }
      let update = { base_id: element.base_id, base: element.base, active: true }
      insertCoinsPromises.push(Coin.findOneAndUpdate(query, update,
        upsertOptions).catch((error) => {
          console.log("Error inserting coin", element.id, error, error.stack)
        }))
    });

    console.log("start inserting coins")
    await Promise.all(insertCoinsPromises)
    console.log("finish inserting coins")

    //update coins
    let updateCoinsPromises = []
    let coinsData

    try {
      coinsData = await Coin.find({})
    } catch (error) {
      console.log("Error fetching coins", error, error.stack)
    }

    if (coinsData) {
      let coinsToDesactivate = coinsData.filter(cd=>cd.added_manually!==true).filter(x => !tickers.find(y => y.base_id === x.base_id))
      coinsToDesactivate.forEach(element => {
        let query = { base_id: element.base_id }
        let update = { active: false }
        updateCoinsPromises.push(Coin.findOneAndUpdate(query, update,
          {}).catch((error) => {
            console.log("Error updating removed currency", element, error, error.stack)
          })
        )
      })

      console.log("start updating coins")
      await Promise.all(updateCoinsPromises)
      console.log("finish updating coins")
    }

    //insert currencies
    let insertCurrenciesPromises = []
    filtered_supported_currencies.forEach(element => {
      let query = { name: element }
      let update = { name: element, active: true }
      insertCurrenciesPromises.push(Currency.findOneAndUpdate(query, update,
        upsertOptions).catch((error) => {
          console.log("Error inserting currency", element, error, error.stack)
        })
      )
    });

    console.log("start inserting currencies")
    await Promise.all(insertCurrenciesPromises)
    console.log("finish inserting currencies")

    //update currencies
    let updateCurrenciesPromises = []
    let currenciesData
    try {
      currenciesData = await Currency.find({})
    } catch (error) {
      console.log("Error fetching currencies", error, error.stack)
    }

    if (currenciesData) {
      let currenciesToDesactivate = currenciesData.filter(x => !filtered_supported_currencies.find(y => y === x.name))
      currenciesToDesactivate.forEach(element => {
        let query = { name: element.name }
        let update = { active: false }
        updateCurrenciesPromises.push(Currency.findOneAndUpdate(query, update,
          {}).catch((error) => {
            console.log("Error updating removed currency", element, error, error.stack)
          }))
      })

      console.log("start updating currencies")
      await Promise.all(updateCurrenciesPromises)
      console.log("finish updating currencies")
    }


    console.log("f", filtered_supported_currencies)
    console.log("c", tickers.length)
  } catch (e) {
    console.log("error detected:", e)
    process.exit(1)
  }
}

start()
setInterval(() => {
  start()
}, process.env.CONFIG_INTERVAL || 86400 * 1000);
