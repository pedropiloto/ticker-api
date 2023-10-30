const client = require("../gateways/redis-gateway");
const health = async (_, res) => {
  try {
    if (client.isReady) {
      res.json({ status: "OK" });
    } else {
      res.status(500).send("NOT OK: Redis not ready");
    }
  } catch (error) {
    res.status(500).send("NOT OK: ERROR", error);
  }
};

module.exports = { health };
