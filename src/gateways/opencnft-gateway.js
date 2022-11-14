const axios = require("axios");

const getFloorPrice = async (floor_price) =>
  axios({
    method: "get",
    url: `https://api.opencnft.io/1/policy/${floor_price}/floor_price`,
  });

const getTopProjects = async () =>
  axios({
    method: "get",
    url: `https://api.opencnft.io/1/rank?window=24h`,
  });

module.exports = {
  getFloorPrice,
  getTopProjects,
};
