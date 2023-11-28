require("dotenv").config()
const express = require("express")
const ministry = express.Router()
const Users = require("../models/users")
const Merchant = require("../models/merchant")
const authFunction = require("../functions/authFunction")
const merchaantMail = require("../mails/merchantMailer")
const Product = require("../models/products")
const ProductCategories = require("../models/product_categories")

ministry.use("/", (req, res, next) => {
  console.log("Time:", Date.now())
  next()
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
          const checkIfUsernameExist = await Users.findOne({
            username: merchant.company_username,
          })
          const checkIfEmailExist = await Users.findOne({
            email: merchant.email,
          })
          if (checkIfUsernameExist || checkIfEmailExist) {
            throw {
              message: `Username or email already exist`,
              isUsernameOrEmailExist: true,
            }
          }
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
      console.log(err)
      if (err.isUsernameOrEmailExist) {
        res.status(400).json({ message: err.message })
      } else {
        res.status(500).json({ message: err.message })
      }
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

ministry.put("/reset-password/merchant/:id", async (req, res) => {
  if (req.headers["authorization"]) {
    try {
      const token = req.headers["authorization"].split(" ")[1]
      const decoded = await authFunction.verifyToken(token)

      if (decoded.is_ministry) {
        const merchant = await Merchant.findOne({
          _id: req.params.id,
        })
        if (merchant.status === "approved") {
          const password = authFunction.generatePassword()
          const hashedPassword = await authFunction.hashPassword(password)
          console.log(`Password: ${password}`)
          const user = await Users.findOne({ merchant_id: merchant._id })
          user.password = hashedPassword
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

ministry.get("/merchant/analytics", async (req, res) => {
  if (req.headers["authorization"]) {
    try {
      const token = req.headers["authorization"].split(" ")[1]
      const decoded = await authFunction.verifyToken(token)

      if (decoded.is_ministry) {
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

ministry.get("/merchant/top_product", async (req, res) => {
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

ministry.get("/merchant/approved", async (req, res) => {
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
