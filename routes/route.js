const express = require("express")
const router = express.Router()
const Users = require("../models/users")
const Merchant = require("../models/merchant")
const formidable = require("formidable")
const product_categories = require("../models/product_categories")
const mv = require("mv")
const path = require("path")
const Products = require("../models/products")
const mongoose = require("mongoose")
const ssTunel = require("../functions/routeFrom")

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
    const merchant = await Merchant.findOne({ _id: req.params.id })
    const originFrom = ssTunel.isFromTunnel(req.headers.origin)
    merchant.document.forEach((document) => {
      document.url = `${originFrom}${document.url}`
    })
    console.log(merchant)
    res.status(200).json(merchant)
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

router.get("/products/", async (req, res) => {
  const page = req.query.page ? parseInt(req.query.page) : 1
  const page_size = req.query.page_size ? parseInt(req.query.page_size) : 10
  const search = req.query.search ? req.query.search : ""
  const categories = req.query.categories ? req.query.categories.split(",") : []
  const min_price = req.query.min_price ? parseFloat(req.query.min_price) : 0
  const max_price = req.query.max_price ? parseFloat(req.query.max_price) : 0

  try {
    // read at https://docs.mongodb.com/manual/reference/operator/aggregation/match/ for more info
    const products = await Products.aggregate([
      {
        $match: {
          $and: [
            categories.length > 0 ? { categories: { $in: categories } } : {},
            {
              $or: [
                // regex for search in name or description, i for case insensitive search
                { name: { $regex: new RegExp(search, "i") } }, // Search in "name" field
                { description: { $regex: new RegExp(search, "i") } }, // Search in "description" field
              ],
            },
            // filter by price
            min_price > 0 ? { price: { $gte: min_price } } : {},
            max_price > 0 ? { price: { $lte: max_price } } : {},
          ],
        },
      },
      {
        $addFields: {
          productIdString: { $toString: "$_id" },
        },
      },
      {
        $lookup: {
          from: "product_pictures",
          localField: "productIdString",
          foreignField: "product_id",
          as: "pictures",
        },
      },
      {
        $skip: page > 1 ? (page - 1) * page_size : 0,
      },
      {
        $limit: page_size,
      },
    ])
    const totalProduct = await Products.find().countDocuments()
    const totalPages = Math.ceil(totalProduct / page_size)

    const originFrom = ssTunel.isFromTunnel(req.headers.origin)
    products.forEach((product) => {
      product.pictures.forEach((picture) => {
        picture.url = `${originFrom}${picture.url}`
      })
    })

    // set next page
    const nextPages =
      page >= totalPages
        ? null
        : `${originFrom}/api/products?page=${page ? page + 1 : 2}&page_size=${
            page_size ? page_size : 10
          }&search=${search ? search : ""}&categories=${
            categories ? categories : ""
          }&min_price=${min_price ? min_price : 0}&max_price=${
            max_price ? max_price : 0
          }`

    // set previous page
    const prevPages =
      page === 1
        ? null
        : `${originFrom}/api/products?page=${page ? page - 1 : 1}&page_size=${
            page_size ? page_size : 10
          }&search=${search ? search : ""}&categories=${
            categories ? categories : ""
          }&min_price=${min_price ? min_price : 0}&max_price=${
            max_price ? max_price : 0
          }`

    res.status(200).json({
      products,
      totalProducts: totalProduct,
      totalPages: totalPages,
      currentPage: parseInt(page),
      next: nextPages,
      prev: prevPages,
    })
  } catch (err) {
    console.log(err)
    res.status(500).json({ message: err.message })
  }
})

router.get("/products/:id", async (req, res) => {
  try {
    const product = await Products.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(req.params.id),
        },
      },
      {
        $addFields: {
          productIdString: { $toString: "$_id" },
        },
      },
      {
        $lookup: {
          from: "product_pictures",
          localField: "productIdString",
          foreignField: "product_id",
          as: "pictures",
        },
      },
    ])

    const originFrom = ssTunel.isFromTunnel(req.headers.origin)
    product[0].pictures.forEach((picture) => {
      picture.url = `${originFrom}${picture.url}`
    })
    res.status(200).json(product[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
