const mongoose = require("mongoose")

const invoice = new mongoose.Schema({
  // invoice
  date_travel: { type: Date, required: true },
  number_of_guest: { type: Number, required: true },
  note: { type: String, required: true },
  created_at: { type: Date, required: true, default: Date.now },

  // amount
  amount_usd: { type: Number, required: true },
  amount_myr: { type: Number, required: true },
  rate: { type: Number, required: true },

  // status
  status: { type: String, required: true },
  response_code: { type: String, required: false, default: null },
  response_stringify: { type: String, required: false, default: null },

  // Foreign key but not referenced
  customer_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  merchant_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  product_id: { type: mongoose.Schema.Types.ObjectId, required: true },
})

module.exports = mongoose.model("Invoice", invoice)
