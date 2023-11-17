const mongoose = require("mongoose")

const product_Pictures_Schema = new mongoose.Schema({
  product_id: { type: String, required: true },
  url: { type: String, required: true },
  filename: { type: String, required: true },
  size: { type: Number, required: true },
  created_at: { type: Date, required: true, default: Date.now },
})

module.exports = mongoose.model("Product_Pictures", product_Pictures_Schema)
