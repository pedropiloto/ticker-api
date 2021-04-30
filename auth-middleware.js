const newrelic = require('newrelic');

module.exports = (req, res, next) => {
  try {
    const device_mac_address = req.headers['device_mac_address']
    console.log("headers", req.headers)
    const api_key = req.headers['api_key']
    if (!!process.env.API_KEY && api_key !== process.env.API_KEY) {
      res.status(401).json({
        error: new Error('Unauthorized')
      });
    } else {
      next();
    }
  } catch {
    res.status(401).json({
      error: new Error('Invalid request!')
    });
  }
};