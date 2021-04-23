
module.exports = {

  get: function(req, res, next) {
        res.json({
          ticker: "dummy",
          quote: 20,
        });
  }
};
