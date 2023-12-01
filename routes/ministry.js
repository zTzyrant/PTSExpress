require("dotenv").config()
const express = require("express")
const ministry = express.Router()
const Users = require("../models/users")
const Merchant = require("../models/merchant")
const authFunction = require("../functions/authFunction")
const merchaantMail = require("../mails/merchantMailer")
const Product = require("../models/products")
const { ministryAuth } = require("../middleware/ministryAuth")

ministry.get("/", ministryAuth, (req, res, next) => {
  console.log("Time:", Date.now())
  res.status(200).json({
    message: "Ministry server is running",
    time: Date.now(),
    user: req.user.fullname,
  })
})

ministry.put("/approve/:id", ministryAuth, async (req, res) => {
  try {
    const merchant = await Merchant.findOne({
      _id: req.params.id,
    })
    console.log(merchant)
    if (merchant.status === "pending") {
      const checkIfUsernameExist = await Users.findOne({
        username: merchant.company_username,
      })
      if (checkIfUsernameExist) {
        return res.status(400).json({ message: `Username already exist` })
      }
      const checkIfEmailExist = await Users.findOne({
        email: merchant.email,
      })
      if (checkIfEmailExist) {
        return res.status(400).json({ message: `Email already exist` })
      }

      // generate password
      const password = authFunction.generatePassword()
      const hashedPassword = await authFunction.hashPassword(password)
      console.log(`Password: ${password}`)

      // creating new user
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
      merchant.status = "approved"
      const response = await Promise.all([newUser.save(), merchant.save()])
      console.log("New user:", response[0])
      console.log("merchant:", response[1])

      const merchant_data = {
        email: merchant.email,
        username: merchant.company_username,
        company_name: merchant.company_name,
        password: password,
      }
      merchaantMail.merchantApproved(merchant_data, res)
    } else {
      res.status(400).json({ message: `Merchant already ${merchant.status}` })
    }
  } catch (err) {
    console.log(err)
    res.status(500).json({ message: err.message })
  }
})

ministry.put("/pending/:id", ministryAuth, async (req, res) => {
  try {
    const merchant = await Merchant.findOne({
      _id: req.params.id,
    })
    if (merchant.status !== "pending") {
      merchant.status = "pending"
      await merchant.save()

      const user = await Users.deleteOne({ merchant_id: merchant._id })
      console.log("Delete user:", user)

      res
        .status(200)
        .json({ message: "Successfully update merchant status to pending" })
    } else {
      res.status(400).json({ message: `Merchant already ${merchant.status}` })
    }
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

ministry.put("/reject/:id", ministryAuth, async (req, res) => {
  try {
    const merchant = await Merchant.findOne({
      _id: req.params.id,
    })
    if (merchant.status === "pending") {
      merchant.status = "rejected"
      await merchant.save()
      res.status(200).json({
        message: `Successfully reject merchant ${merchant.company_name}`,
      })
    } else {
      res.status(400).json({ message: `Merchant already ${merchant.status}` })
    }
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

ministry.put("/reset-password/merchant/:id", ministryAuth, async (req, res) => {
  try {
    const merchant = await Merchant.findOne({
      _id: req.params.id,
    })
    if (merchant.status === "approved") {
      // generate password
      const password = authFunction.generatePassword()
      const hashedPassword = await authFunction.hashPassword(password)
      console.log(`Password: ${password}`)

      const user = await Users.findOne({ merchant_id: merchant._id })
      user.password = hashedPassword
      user.is_first_login = true // set to true so that user will be force to change password
      await user.save()
      const merchant_data = {
        email: merchant.email,
        username: merchant.company_username,
        company_name: merchant.company_name,
        password: password,
      }
      merchaantMail.merchantResetPassword(merchant_data, res)
    } else {
      res
        .status(400)
        .json({ message: `Invalid merchant status is ${merchant.status}` })
    }
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

ministry.get("/merchant/analytics", ministryAuth, async (req, res) => {
  try {
    const merchantCount = await Merchant.countDocuments()
    const pendingMerchant = await Merchant.countDocuments({
      status: "pending",
    })
    const approvedMerchant = await Merchant.countDocuments({
      status: "approved",
    })
    const rejectedMerchant = await Merchant.countDocuments({
      status: "rejected",
    })

    res.status(200).json({
      merchantCount,
      pendingMerchant,
      approvedMerchant,
      rejectedMerchant,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

ministry.get("/merchant/top_product", ministryAuth, async (req, res) => {
  const { merchant_id, limit } = req.query
  console.log(merchant_id)
  try {
    let topProduct = await Product.aggregate([
      {
        $match: merchant_id ? { merchant_id: merchant_id } : {},
      },
      {
        $lookup: {
          from: "invoices",
          localField: "_id",
          foreignField: "product_id",
          as: "invoices",
          pipeline: [
            {
              $match: {
                status: "paid",
              },
            },
          ],
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          price: 1,
          product_sold: { $size: "$invoices" },
          amount_sold: { $multiply: ["$price", { $size: "$invoices" }] },
        },
      },
      {
        $sort: {
          product_sold: -1,
        },
      },
    ])
    topProduct = limit ? topProduct.slice(0, limit) : topProduct
    res.status(200).json(topProduct)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

ministry.get("/merchant/approved", ministryAuth, async (req, res) => {
  try {
    const merchant = await Merchant.aggregate([
      {
        $match: { status: "approved" },
      },
      {
        $project: {
          _id: 1,
          company_name: 1,
        },
      },
    ])
    res.status(200).json(merchant)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = ministry
