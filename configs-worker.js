require('newrelic');
const getMetricEmitter = require('@newrelic/native-metrics')
const { getSupportedCurrencies, getCoinsMarket } = require("./gateways/coingecko-gateway");
const Coin = require("./models/coin");
const Currency = require("./models/currency");
const SUPPORTED_CURRENCIES = require("./supported-currencies");
const mongoose = require("./config/database"); //database configuration
const Bugsnag = require('@bugsnag/js');
const { log } = require('./utils/logger');
const {
  OPERATIONAL_LOG_TYPE, BUSINESS_LOG_TYPE, ERROR_SEVERITY,
} = require('./utils/constants');

if (process.env.NODE_ENV === 'production' && process.env.BUSGNAG_API_KEY) {
  Bugsnag.start({
    apiKey: `${process.env.BUSGNAG_API_KEY}`
  });
}

const start = async () => {
  log({
    message: `starting configs-worker`, type: BUSINESS_LOG_TYPE, transactional: false
  });
  try {
    mongoose.connection.on(
      "error",
      () => {
        log({
          message: 'MongoDB connection error',
          type: OPERATIONAL_LOG_TYPE,
          transactional: false,
          severity: ERROR_SEVERITY,
        });
        Bugsnag.notify(new Error('MongoDB connection error'));
      }
    );

    let coins = []

    log({
      message: `start fetching coins from api`, type: BUSINESS_LOG_TYPE, transactional: false
    });
    for (let i = 0; i < 35; i++) {
      let coins_response = await getCoinsMarket(i + 1)
      coins = coins.concat(coins_response.data)
    }
    log({
      message: `coins fetched from api: ${coins.length}`, type: BUSINESS_LOG_TYPE, transactional: false
    });

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
          log({
            message: `ERROR inserting coin: ${error.stack}, coin: ${element.id}`, type: BUSINESS_LOG_TYPE, transactional: false
          });
          Bugsnag.notify(error);
        }))
    });

    await Promise.all(insertCoinsPromises)

    //update coins
    let updateCoinsPromises = []
    let coinsData

    try {
      coinsData = await Coin.find({})
    } catch (error) {
      log({
        message: `ERROR fetching coins from db: ${error.stack}`, type: BUSINESS_LOG_TYPE, transactional: false
      });
      Bugsnag.notify(error);
    }

    if (coinsData) {
      let coinsToDesactivate = coinsData.filter(cd => cd.added_manually !== true).filter(x => !tickers.find(y => y.base_id === x.base_id))
      coinsToDesactivate.forEach(element => {
        let query = { base_id: element.base_id }
        let update = { active: false }
        updateCoinsPromises.push(Coin.findOneAndUpdate(query, update,
          {}).catch((error) => {
            log({
              message: `ERROR updating removed coin: ${error.stack}, coin: ${element}`, type: BUSINESS_LOG_TYPE, transactional: false
            });
            Bugsnag.notify(error);
          })
        )
      })

      log({
        message: `sstart updating coins`, type: BUSINESS_LOG_TYPE, transactional: false
      });
      await Promise.all(updateCoinsPromises)
      log({
        message: `finish updating coins`, type: BUSINESS_LOG_TYPE, transactional: false
      });
    }

    //insert currencies
    let insertCurrenciesPromises = []
    filtered_supported_currencies.forEach(element => {
      let query = { name: element }
      let update = { name: element, active: true }
      insertCurrenciesPromises.push(Currency.findOneAndUpdate(query, update,
        upsertOptions).catch((error) => {
          log({
            message: `ERROR iinserting currency: ${error.stack}, currency: ${element}`, type: BUSINESS_LOG_TYPE, transactional: false
          });
          Bugsnag.notify(error);
        })
      )
    });

    log({
      message: `start inserting currencies`, type: BUSINESS_LOG_TYPE, transactional: false
    });
    await Promise.all(insertCurrenciesPromises)
    log({
      message: `finish inserting currencies`, type: BUSINESS_LOG_TYPE, transactional: false
    });

    //update currencies
    let updateCurrenciesPromises = []
    let currenciesData
    try {
      currenciesData = await Currency.find({})
    } catch (error) {
      log({
        message: `ERROR fetching currencies: ${error.stack}`, type: BUSINESS_LOG_TYPE, transactional: false
      });
      Bugsnag.notify(error);
    }

    if (currenciesData) {
      let currenciesToDesactivate = currenciesData.filter(x => !filtered_supported_currencies.find(y => y === x.name))
      currenciesToDesactivate.forEach(element => {
        let query = { name: element.name }
        let update = { active: false }
        updateCurrenciesPromises.push(Currency.findOneAndUpdate(query, update,
          {}).catch((error) => {
            log({
              message: `ERROR updating removed currency: ${error.stack}, currency: ${element}`, type: BUSINESS_LOG_TYPE, transactional: false
            });
            Bugsnag.notify(error);
          }))
      })

      log({
        message: `start updating currencies`, type: BUSINESS_LOG_TYPE, transactional: false
      });
      await Promise.all(updateCurrenciesPromises)
      log({
        message: `finish updating currencies`, type: BUSINESS_LOG_TYPE, transactional: false
      });
    }
  } catch (error) {
    log({
      message: `UNKNOWN ERROR: ${error.stack}`, type: BUSINESS_LOG_TYPE, transactional: false
    });
    Bugsnag.notify(error);
    process.exit(1)
  }
}

var emitter = getMetricEmitter()
if (emitter.gcEnabled) {
  setInterval(() => {
    emitter.getGCMetrics()
  }, 1000)
}

if (emitter.loopEnabled) {
  setInterval(() => {
    emitter.getLoopMetrics()
  }, 1000)
}

start()
setInterval(() => {
  start()
}, process.env.CONFIG_INTERVAL || 86400 * 1000);
