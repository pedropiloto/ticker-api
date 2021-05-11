require('newrelic');
const express = require("express");
const logger = require("morgan");
const tickerController = require("./controllers/tickerController");
const authMiddleware = require("./auth-middleware")
const app = express();
const mongoose = require("./config/database"); //database configuration
const getMetricEmitter = require('@newrelic/native-metrics')
const { log } = require('./utils/logger');
const {
  OPERATIONAL_LOG_TYPE, ERROR_SEVERITY,
} = require('./utils/constants');
const Bugsnag = require('@bugsnag/js');
var BugsnagPluginExpress = require('@bugsnag/plugin-express')


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

if (process.env.NODE_ENV === 'production' && process.env.BUSGNAG_API_KEY) {
  Bugsnag.start({
    apiKey: `${process.env.BUSGNAG_API_KEY}`,
    plugins: [BugsnagPluginExpress]
  });
  const bugsnagMiddleware = Bugsnag.getPlugin('express')
  app.use(bugsnagMiddleware.requestHandler)
  app.use(bugsnagMiddleware.errorHandler)
}

app.use(logger("dev"));

// private route

app.get("/ticker", authMiddleware, tickerController.get);
app.get("/ticker/config", authMiddleware, tickerController.getTickers);
app.get("/coin/:name", authMiddleware, tickerController.getCoin);

const port = process.env.PORT || 3000;

app.listen(port, function () {
  log({
    message: `Node server listening on port ${port}`,
    type: OPERATIONAL_LOG_TYPE,
    transactional: false,
  });
});

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
