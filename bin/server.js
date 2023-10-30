require("newrelic");
const Bugsnag = require("@bugsnag/js");
var BugsnagPluginExpress = require("@bugsnag/plugin-express");
const express = require("express");
const morganLogger = require("morgan");
require("dotenv").config();

const TickerController = require("../src/controllers/ticker-controller");
const CnftFloorController = require("../src/controllers/cnft-floor-controller");
const EthNftFloorController = require("../src/controllers/eth-nft-floor-controller");
const HealthController = require("../src/controllers/health-controller");
const AuthMiddleware = require("../src/middlewares/auth-middleware");
const NoAuthMiddleware = require("../src/middlewares/no-auth-middleware");
const { getLogger } = require("../src/utils/logger");
const logResponseTime = require("../src/middlewares/response-time-logger-middleware");
const logError = require("../src/middlewares/error-logger-middleware");
const responseTime = require("response-time");

const logger = getLogger();

const app = express();

app.use(morganLogger("dev"));
app.use(responseTime(logResponseTime));

// Routes
app.get("/ticker", AuthMiddleware, TickerController.get);
app.get("/ticker/config", AuthMiddleware, TickerController.getTickers);
app.get("/coin/:name", AuthMiddleware, TickerController.getCoin);
app.get("/currencies", AuthMiddleware, TickerController.getCurrencies);
app.get(
  "/cnft/:policy/floor",
  AuthMiddleware,
  CnftFloorController.getFloorPriceByPolicy
);
app.get("/cnft/projects", AuthMiddleware, CnftFloorController.getTopProjects);
app.get(
  "/eth_nft/projects",
  AuthMiddleware,
  EthNftFloorController.getTopProjects
);
app.get(
  "/eth_nft/:slug/floor",
  AuthMiddleware,
  EthNftFloorController.getFloorPriceBySlug
);
app.get("/health", NoAuthMiddleware, HealthController.health);

const port = process.env.PORT || 3000;

app.use(logError);

app.listen(port, function () {
  logger.info(`Node server listening on port ${port}`);
});

if (process.env.NODE_ENV === "production" && process.env.BUSGNAG_API_KEY) {
  Bugsnag.start({
    apiKey: `${process.env.BUSGNAG_API_KEY}`,
    plugins: [BugsnagPluginExpress],
  });
  const bugsnagMiddleware = Bugsnag.getPlugin("express");
  app.use(bugsnagMiddleware.requestHandler);
  app.use(bugsnagMiddleware.errorHandler);
}
