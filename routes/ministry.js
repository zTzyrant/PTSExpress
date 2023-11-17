require("dotenv").config()
const express = require("express")
const ministry = express.Router()
const Users = require("../models/users")
const Merchant = require("../models/merchant")
const authFunction = require("../functions/authFunction")
const merchaantMail = require("../mails/merchantMailer")

ministry.get("/", (req, res) => {
  res.send("Hello world from ministry")
})

ministry.put("/approve/:id", async (req, res) => {
  if (req.headers["authorization"]) {
    try {
      const token = req.headers["authorization"].split(" ")[1]
      const decoded = await authFunction.verifyToken(token)
      if (decoded.is_ministry) {
        const merchant = await Merchant.findOne({
          _id: req.params.id,
        })
        console.log(merchant)
        if (merchant.status === "pending") {
          const password = authFunction.generatePassword()
          const hashedPassword = await authFunction.hashPassword(password)
          console.log(`Password: ${password}`)
          const newUser = new Users({
            username: merchant.company_username,
            email: merchant.email,
            password: hashedPassword,
            fullname: `${merchant.company_name} Representative`,
            phone_number: merchant.contact_number,
            is_ministry: false,
            is_merchant: true,
            is_customer: false,
            merchant_id: merchant._id,
            date_of_birth: null,
            is_first_login: true,
          })
          await newUser.save()
          merchant.status = "approved"
          await merchant.save()
          const merchant_data = {
            email: merchant.email,
            username: merchant.company_username,
            company_name: merchant.company_name,
            password: password,
          }
          merchaantMail.merchantApproved(merchant_data, res)
        } else {
          res
            .status(400)
            .json({ message: `Merchant already ${merchant.status}` })
        }
      } else {
        res.status(403).json({ message: "Forbidden not ministry" })
      }
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  } else {
    res.status(403).json({ message: "Forbidden" })
  }
})

ministry.put("/reject/:id", async (req, res) => {
  if (req.headers["authorization"]) {
    try {
      const token = req.headers["authorization"].split(" ")[1]
      const decoded = await authFunction.verifyToken(token)

      if (decoded.is_ministry) {
        const merchant = await Merchant.findOne({
          _id: req.params.id,
        })
        if (merchant.status === "pending") {
          merchant.status = "rejected"
          await merchant.save()
          res.status(200).json({ message: "Merchant rejected" })
        } else {
          res
            .status(400)
            .json({ message: `Merchant already ${merchant.status}` })
        }
      } else {
        res.status(403).json({ message: "Forbidden not ministry" })
      }
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  } else {
    res.status(403).json({ message: "Forbidden" })
  }
})
module.exports = ministry
