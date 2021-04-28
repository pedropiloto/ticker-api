const express = require("express");
const logger = require("morgan");
const tickerController = require("./controllers/tickerController");
const app = express();
const mongoose = require("./config/database"); //database configuration

const start = () => {

  mongoose.connection.on(
    "error",
    console.error.bind(console, "MongoDB connection error:")
  );

  app.use(logger("dev"));

  // private route

  app.get("/ticker", tickerController.get);
  app.get("/ticker/config", tickerController.getTickers);


  app.get("/favicon.ico", function(req, res) {
    res.sendStatus(204);
  });

  // express doesn't consider not found 404 as an error so we need to handle 404 it explicitly
  // handle 404 error
  app.use(function(req, res, next) {
    let err = new Error("Not Found");
    err.status = 404;
    next(err);
  });

  // handle errors
  app.use(function(err, req, res, next) {
    console.log(err);

    if (err.status === 404) res.status(404).json({ message: "Not found" });
    else res.status(500).json({ message: "Something looks wrong :( !!!" });
  });

  const port = process.env.PORT || 3000;

  app.listen(port, function() {
    console.log("Node server listening on port", port);
  });
};

start()
