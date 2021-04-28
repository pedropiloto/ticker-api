const mongoose = require("mongoose");

//Define a schema
const Schema = mongoose.Schema;

const CoinSchema = new Schema({
  base: {
    type: String,
    trim: true,
    required: true,
  },
  base_id: {
    type: String,
    index: true,
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

module.exports = mongoose.model("Coin", CoinSchema);
