const axios = require("axios");

const getFloorPrice = async (policy) =>
  axios({
    method: "get",
    url: `https://api.opencnft.io/2/collection/${policy}/floor_price`,
    headers: {
      "X-Api-Key": process.env.OPEN_CNFT_API_KEY,
    },
  });

const getTopProjects = async () =>
  axios({
    method: "get",
    url: `https://api.opencnft.io/2/market/rank/collection`,
    headers: {
      "X-Api-Key": process.env.OPEN_CNFT_API_KEY,
    },
  });

module.exports = {
  getFloorPrice,
  getTopProjects,
};
