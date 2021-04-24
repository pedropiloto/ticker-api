
module.exports = {

  get: function(req, res, next) {
    res.send(`${Math.floor(Math.random() * 1000)}`)
  }
};
