require("dotenv").config();

//Set up mongoose connection
console.log("in db config");
const mongoose = require("mongoose");
const nodeEnv = process.env.NODE_ENV;
const mongoDB = process.env.MONGO_URL;
console.log("Mongo URL", mongoDB);
mongoose.set("useFindAndModify", false);
mongoose.set('useCreateIndex', true);
mongoose.connect(mongoDB, {useNewUrlParser: true});
mongoose.Promise = global.Promise;

module.exports = mongoose;
/*const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));*/
