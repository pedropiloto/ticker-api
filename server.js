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

  // express doesn't consider not found 404 as an error so we need to handle 404 it explicitly
  // handle 404 error

  // // handle errors
  // app.use(function(err, req, res, next) {
  //   console.log(err);

  //   if (err.status === 404) res.status(404).json({ message: "Not found" });
  //   else res.status(500).json({ message: "Something looks wrong :( !!!" });
  // });

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
