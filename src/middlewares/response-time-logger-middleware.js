const { getLogger } = require("../utils/logger");

module.exports = (req, res, time) => {
  const logger = getLogger();
  const method = req.method;
  const url = req.url;
  const status = res.statusCode;
  const ticker = req.query.name && req.query.name.toUpperCase();
  const labels = { url };
  if (ticker) {
    labels["ticker"] = ticker;
  }
  if (url !== "/health") {
    logger.info({
      message: `method=${method} url=${url} status=${status} duration=${time}ms`,
      labels,
    });
  }
};
