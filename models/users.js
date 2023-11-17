const mongoose = require("mongoose")

const usersSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  fullname: { type: String, required: true },
  phone_number: { type: String, required: true },
  is_ministry: { type: Boolean, required: true },
  is_merchant: { type: Boolean, required: true },
  is_customer: { type: Boolean, required: true },
  is_first_login: { type: Boolean, required: true, default: false },
  date_of_birth: { type: Date, required: false },
  merchant_id: { type: String, required: false },
  created_at: { type: Date, required: true, default: Date.now },
})

module.exports = mongoose.model("Users", usersSchema)
