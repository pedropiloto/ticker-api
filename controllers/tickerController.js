
const tickers = require("./tickers");


  const get = (req, res, next) => {
    res.send(`${Math.floor(Math.random() * 1000000)}`)
  }

  const getTickers =  (req, res, next)  => {
    res.json(tickers)
  }

module.exports ={get, getTickers};
