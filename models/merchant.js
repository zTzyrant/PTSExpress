const mongoose = require("mongoose")

const merchantSchema = new mongoose.Schema({
  company_name: { type: String, required: true },
  company_username: { type: String, required: true },
  contact_number: { type: String, required: true },
  email: { type: String, required: true },
  company_description: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  country: { type: String, required: true },
  status: { type: String, required: true },
  document: [
    {
      url: { type: String, required: true },
      filename: { type: String, required: true },
      description: { type: String, required: true },
      created_at: { type: Date, required: true, default: Date.now },
    },
  ],
  created_at: { type: Date, required: true, default: Date.now },
})

module.exports = mongoose.model("Merchant", merchantSchema)
