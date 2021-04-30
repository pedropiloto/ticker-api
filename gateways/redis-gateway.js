require("dotenv").config();
const redis = require("redis");
const { promisify } = require("util");

options = {
  port: process.env.REDIS_PORT,
  host: process.env.REDIS_URL,
}

if(process.env.REDIS_PASSWORD){
  options['password'] = process.env.REDIS_PASSWORD
}

client = redis.createClient(options);

client.on('connect', () => {
  console.log('Redis client connected');
});

client.on('error', err => {
  console.log('Redis Error ' + err);
});

const get = promisify(client.get).bind(client);
const set = promisify(client.set).bind(client);
const expire = promisify(client.expire).bind(client);

module.exports = {
    get,
    set,
    expire
};