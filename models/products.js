const mongoose = require("mongoose")

const productSchema = new mongoose.Schema({
  merchant_id: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  number_of_guests: { type: Number, required: true },
  limit_order: { type: Number, required: true },
  hotel_grade: { type: Number, required: true, default: 0 },
  categories: { type: [], required: true },

  // facilities
  include_wifi: { type: Boolean, required: true, default: false },
  include_foods: { type: Boolean, required: true, default: false },
  include_hotel: { type: Boolean, required: true, default: false },
  include_transportation: { type: Boolean, required: true, default: false },

  // address destination or products
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  post_code: { type: String, required: true },
  country: { type: String, required: true },

  // descriptions
  description: { type: String, required: true },

  created_at: { type: Date, required: true, default: Date.now },
})

module.exports = mongoose.model("Products", productSchema)
