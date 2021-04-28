const mongoose = require("mongoose");

//Define a schema
const Schema = mongoose.Schema;

const CurrencySchema = new Schema({
  name: {
    type: String,
    trim: true,
    required: true
  },
  active: {
    type: Boolean,
    trim: true,
    required: true,
    default: true
  },

},
{timestamps:true});

module.exports = mongoose.model("Currency", CurrencySchema);
