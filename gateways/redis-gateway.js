require("dotenv").config();
const redis = require("redis");

client = redis.createClient({
  port: process.env.REDIS_PORT,
  host: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD
});

client.on('error', err => {
  console.log('Redis Error ' + err);
});

module.exports = client