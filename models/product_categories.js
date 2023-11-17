const mongoose = require("mongoose")
const product_categories = new mongoose.Schema({
  categories: { type: Array, required: true },
})

module.exports = mongoose.model("Product_Categories", product_categories)
