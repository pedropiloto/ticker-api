const newrelic = require("newrelic");
const Bugsnag = require("@bugsnag/js");

const TickerQuoteInteractor = require("../interactors/ticker-quote");
const { getLogger } = require("../utils/logger");
const { UndefinedResultError, UnsupportedTickerError } = require("../errors");

const logger = getLogger();

// eslint-disable-next-line no-unused-vars
const get = async (req, res, next) => {
  addNewRelicCustomAttributes(req);
  const tickerName = req.query.name;
  let retries = 0;
  const maxRetries = 1;

  while (retries <= maxRetries) {
    try {
      const resultQuote = await TickerQuoteInteractor.call(tickerName);
      if (!resultQuote && retries === maxRetries) {
        res.status(400).send("Unsupported");
        return;
      }
      if(!resultQuote) {
        throw new UndefinedResultError();
      }
      newrelic.addCustomAttribute("cached", resultQuote.isCached);
      res.send(resultQuote.value);
      return;
    } catch (error) {
      if (error instanceof UnsupportedTickerError) {
        res.status(400).send("Unsupported");
        return;
      }
      logger.error(`RETRY ${retries}. UNKNOWN ERROR: ${error.stack}, ticker: ${tickerName}.`);
      if (retries === maxRetries) {
        logger.error(`MAX RETRIES. UNKNOWN ERROR: ${error.stack}, ticker: ${tickerName}.`);
        Bugsnag.notify(error);
        newrelic.noticeError(error);
        res.status(500).send("Upstream Error");
        return;
      }
      retries++;
    }
  }
};

// eslint-disable-next-line no-unused-vars
const getTickers = async (req, res, next) => {
  try {
    addNewRelicCustomAttributes(req);
    const page = req.query.page ? req.query.page : 1;
    const limit = 250;

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const result = await TickerQuoteInteractor.listConfig(startIndex, endIndex);
    res.json(result);
  } catch (error) {
    logger.error(`UNKNOWN ERROR: ${error.stack}`);
    Bugsnag.notify(error);
    newrelic.noticeError(error);
    res.status(500).send("Upstream Error");
  }
};

// eslint-disable-next-line no-unused-vars
const getCoin = async (req, res, next) => {
  try {
    addNewRelicCustomAttributes(req);

    let coinRequested = req.params.name && req.params.name.toUpperCase();
    let coin = await TickerQuoteInteractor.getCoin(coinRequested);

    if (coin) {
      res.json(coin);
    } else {
      res.status(404).send("Coin does not exist");
    }
  } catch (error) {
    logger.error(`UNKNOWN ERROR: ${error.stack}`);
    Bugsnag.notify(error);
    newrelic.noticeError(error);
    res.status(500).send("Upstream Error");
  }
};

// eslint-disable-next-line no-unused-vars
const getCurrencies = async (req, res, next) => {
  try {
    addNewRelicCustomAttributes(req);

    res.json({ currencies: await TickerQuoteInteractor.getCurrencies() });
  } catch (error) {
    logger.error(`UNKNOWN ERROR: ${error.stack}`);
    Bugsnag.notify(error);
    newrelic.noticeError(error);
    res.status(500).send("Upstream Error");
  }
};

const addNewRelicCustomAttributes = (req) => {
  newrelic.addCustomAttribute(
    "device_mac_address",
    req.headers["device-mac-address"]
  );
  newrelic.addCustomAttribute(
    "device_model",
    req.headers["device-model"] || "MULTI_COIN"
  );
  newrelic.addCustomAttribute(
    "device_version",
    req.headers["device-version"] || "1.0.0"
  );
  newrelic.addCustomAttribute("ticker_name", req.query.name);
  newrelic.addCustomAttribute(
    "coin",
    req.params.name && req.params.name.toUpperCase()
  );
};

module.exports = { get, getTickers, getCoin, getCurrencies };
