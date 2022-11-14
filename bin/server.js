require("newrelic");
const Bugsnag = require("@bugsnag/js");
var BugsnagPluginExpress = require("@bugsnag/plugin-express");
const express = require("express");
const morganLogger = require("morgan");
const getMetricEmitter = require("@newrelic/native-metrics");
const pino = require("pino");
require("dotenv").config();

const TickerController = require("../src/controllers/ticker-controller");
const CnftFloorController = require("../src/controllers/cnft-floor-controller");
const EthNftFloorController = require("../src/controllers/eth-nft-floor-controller");
const authMiddleware = require("../src/auth-middleware");

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  prettyPrint: { colorize: true },
});

const app = express();

app.use(morganLogger("dev"));

// Routes
app.get("/ticker", authMiddleware, TickerController.get);
app.get("/ticker/config", authMiddleware, TickerController.getTickers);
app.get("/coin/:name", authMiddleware, TickerController.getCoin);
app.get("/currencies", authMiddleware, TickerController.getCurrencies);
app.get(
  "/cnft/:policy/floor",
  authMiddleware,
  CnftFloorController.getFloorPriceByPolicy
);
app.get("/cnft/projects", authMiddleware, CnftFloorController.getTopProjects);
app.get(
  "/eth_nft/projects",
  authMiddleware,
  EthNftFloorController.getTopProjects
);
app.post(
  "/eth_nft/projects",
  authMiddleware,
  EthNftFloorController.updateTopProjects
);
app.get(
  "/eth_nft/:slug/floor",
  authMiddleware,
  EthNftFloorController.getFloorPriceBySlug
);

const port = process.env.PORT || 3000;

app.listen(port, function () {
  logger.info(`Node server listening on port ${port}`);
});

var emitter = getMetricEmitter();
if (emitter.gcEnabled) {
  setInterval(() => {
    emitter.getGCMetrics();
  }, 1000);
}

if (emitter.loopEnabled) {
  setInterval(() => {
    emitter.getLoopMetrics();
  }, 1000);
}

if (process.env.NODE_ENV === "production" && process.env.BUSGNAG_API_KEY) {
  Bugsnag.start({
    apiKey: `${process.env.BUSGNAG_API_KEY}`,
    plugins: [BugsnagPluginExpress],
  });
  const bugsnagMiddleware = Bugsnag.getPlugin("express");
  app.use(bugsnagMiddleware.requestHandler);
  app.use(bugsnagMiddleware.errorHandler);
}
