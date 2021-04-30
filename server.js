require('newrelic');
const express = require("express");
const logger = require("morgan");
const tickerController = require("./controllers/tickerController");
const authMiddleware = require("./auth-middleware")
const app = express();
const mongoose = require("./config/database"); //database configuration
const getMetricEmitter = require('@newrelic/native-metrics')

const start = () => {

  mongoose.connection.on(
    "error",
    console.error.bind(console, "MongoDB connection error:")
  );

  app.use(logger("dev"));

  // private route

  app.get("/ticker", authMiddleware, tickerController.get);
  app.get("/ticker/config", authMiddleware, tickerController.getTickers);

  const port = process.env.PORT || 3000;

  app.listen(port, function() {
    console.log("Node server listening on port", port);
  });

  var emitter = getMetricEmitter()
if (emitter.gcEnabled) {
  setInterval(() => {
    emitter.getGCMetrics()
  }, 1000)
}
if (emitter.usageEnabled) {
  emitter.on('usage', (usage) => console.log(usage))
}
if (emitter.loopEnabled) {
  setInterval(() => {
    emitter.getLoopMetrics()
  }, 1000)
}
};

start()
