require('dotenv').config();
const axios = require('axios');
const Bottleneck = require('bottleneck');

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 5000, // pick a value that makes sense for your use case
});

// eslint-disable-next-line import/prefer-default-export
const getCoinsList = async () => {
  return limiter.wrap(() => axios({
    method: 'get',
    url: 'https://api.coingecko.com/api/v3/coins/list',
  }))();
};

const getSupportedCurrencies = async () => {
  return limiter.wrap(() => axios({
    method: 'get',
    url: 'https://api.coingecko.com/api/v3/simple/supported_vs_currencies',
  }))();
};

const getSimplePrice = async (coin, currency) => {
  return limiter.wrap(() => axios({
    method: 'get',
    url: `https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=${currency}&include_24hr_change=true`,
  }))();
};

module.exports = {
  getCoinsList, getSupportedCurrencies, getSimplePrice
};
