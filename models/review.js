const mongoose = require("mongoose")

const review = new mongoose.Schema({
  // invoice
  invoice_id: { type: mongoose.Schema.Types.ObjectId, required: true },

  // Foreign key but not referenced
  customer_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  merchant_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  product_id: { type: mongoose.Schema.Types.ObjectId, required: true },

  // review
  rating: { type: Number, required: true, default: 0 },
  comment: { type: String, required: true },
  is_recommend: { type: Boolean, required: true, default: false },
  created_at: { type: Date, required: true, default: Date.now },
})

module.exports = mongoose.model("Review", review)
