const express = require("express");
const logger = require("morgan");
const { getCoinsList, getSupportedCurrencies } = require("./gateways/coingecko-gateway");
const SUPPORTED_CURRENCIES = require("./supported-currencies");
const app = express();
const { exists } = require("./models/coin");

const MAX_RETRIES = 4

const start = async () => {
  client.on('error', err => {
    console.log('Error ' + err);
});

client.set('foo', 'bar', (err, reply) => {
  if (err) throw err;
  console.log(reply);
});
}

  start()



  console.log("pppp")