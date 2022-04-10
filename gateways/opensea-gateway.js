require('dotenv').config();
const axios = require('axios');
const OpenseaScraper = require("opensea-scraper");

// eslint-disable-next-line import/prefer-default-export
const getTopProjects = async () => OpenseaScraper.rankings("7d", {}, "ethereum");

const getCollectionDetailsBySlug = async (slug) => axios({
  method: 'get',
  url: `https://api.opensea.io/api/v1/collection/${slug}`,
  headers: {
    'X-API-KEY': process.env.OPEN_SEA_API_KEY
  }
})

module.exports = {
  getTopProjects, getCollectionDetailsBySlug
};
