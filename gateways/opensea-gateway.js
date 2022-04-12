require('dotenv').config();
const axios = require('axios');
const OpenseaScraper = require("opensea-scraper");

const puppeteer = require('puppeteer-extra');
// add stealth plugin and use defaults (all evasion techniques)
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const getTopProjects = async () => {
  let browser

  if (process.env.CUSTOM_CHROMIUM_EXECUTABLE_PATH) {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.CUSTOM_CHROMIUM_EXECUTABLE_PATH,
      args: [
        '--no-sandbox',
        '--disable-gpu',
      ]
    });
  } else {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disabled-setupid-sandbox"]
    });
  }


  return OpenseaScraper.rankings("7d", { browserInstance: browser }, "ethereum")
}

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
