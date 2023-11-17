const express = require("express")
const router = express.Router()
const Users = require("../models/users")
const Merchant = require("../models/merchant")
const formidable = require("formidable")
const product_categories = require("../models/product_categories")
const mv = require("mv")
const path = require("path")

router.get("/", (req, res) => {
  res.send("Hello world")
})

router.get("/users", async (req, res) => {
  try {
    const users = await Users.find()
    res.status(200).json(users)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get("/users/:id", async (req, res) => {
  try {
    const users = await Users.find({ _id: req.params.id })
    res.status(200).json(users)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post("/users/", async (req, res) => {
  const user = new Users({
    username: req.body.username,
    password: req.body.password,
    email: req.body.email,
    fullname: req.body.fullname,
    date_of_birth: req.body.date_of_birth ? req.body.date_of_birth : null,
    phone_number: req.body.phone_number,
    is_ministry: req.body.is_ministry,
    is_merchant: req.body.is_merchant,
    is_customer: req.body.is_customer,
  })
  try {
    const newUser = await user.save()
    res.status(201).json(newUser)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

router.post("/merchant", async (req, res) => {
  const form_data = new formidable.IncomingForm()
  form_data.parse(req, async function (err, fields, files) {
    const {
      company_name,
      company_username,
      contact_number,
      email,
      company_description,
      address,
      city,
      state,
      country,
      status,
      filename,
    } = fields
    console.log(filename)
    if (
      !company_name ||
      !company_username ||
      !contact_number ||
      !email ||
      !company_description ||
      !address ||
      !city ||
      !state ||
      !country ||
      !status ||
      !filename ||
      !filename.length > 0
    ) {
      res.status(400).json({ message: "Invalid input" })
    } else {
      const isMerchantRegisterd = await Merchant.find({
        company_username: company_username[0],
      })
      if (!isMerchantRegisterd.length > 0) {
        try {
          let document = []
          for (let i = 0; i < files.file.length; i++) {
            let oldpath = files.file[i].filepath
            const filename = `${fields.filename[i]}-${Date.now()}.${files.file[
              i
            ].originalFilename
              .split(".")
              .pop()}`
            let newpath = path.join(__dirname, "../uploads/" + filename)
            mv(oldpath, newpath, function (err) {
              if (err) throw err
            })

            document.push({
              url: `/uploads/${filename}`,
              filename: filename,
              description: fields.file_description[i],
            })
          }
          console.log(document)
          const merchant = new Merchant({
            company_name: company_name[0],
            company_username: company_username[0],
            contact_number: contact_number[0],
            email: email[0],
            company_description: company_description[0],
            address: address[0],
            city: city[0],
            state: state[0],
            country: country[0],
            status: "pending",
            document: document,
          })
          const savedMerchant = await merchant.save()
          res.status(200).json(savedMerchant)
        } catch (err) {
          console.log(err)
          res.status(500).json({ message: err.message })
        }
      } else {
        res.status(400).json({ message: "Merchant already registered" })
      }
    }
  })
})

router.get("/merchant/:id", async (req, res) => {
  try {
    const merchant = await Merchant.find({ _id: req.params.id })
    res.status(200).json(merchant[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get("/merchant_all_without_pagination", async (req, res) => {
  try {
    const merchant = await Merchant.find()
    res.status(200).json(merchant)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get("/product/categories", async (req, res) => {
  try {
    const categories = await product_categories.findOne()
    res.status(200).json({ categories: categories.categories })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
