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
const Invoice = require("../models/invoice")
const fs = require("fs-extra")
const util = require("util")
const mvPromise = util.promisify(mv)

// Function to check if the file type is allowed
function isFileTypeAllowed(fileType) {
  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]
  return allowedTypes.includes(fileType)
}

// Remove all incomming files from temp/uploads
const cleanTempUploads = (files) => {
  files.forEach((file) => {
    console.log(`Deleting ${file.originalFilename}`)
    fs.unlinkSync(file.filepath)
  })
}

// test route
router.get("/", (req, res) => {
  res.send("Hello world")
})

// get all users for testing
router.get("/users", async (req, res) => {
  try {
    const users = await Users.aggregate([
      {
        $project: {
          username: 1,
          fullname: 1,
        },
      },
    ])
    res.status(200).json(users)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// get user by id for testing
router.get("/users/:id", async (req, res) => {
  try {
    const users = await Users.find({ _id: req.params.id }).select("-password")
    res.status(200).json(users)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// post user with out validation for testing
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

/**
 * @POST /api/users
 * @returns {object} merchant
 * @description Register new merchant with strict validation
 */
router.post("/merchant", async (req, res) => {
  const form_data = new formidable.IncomingForm({
    multiples: true,
    uploadDir: path.join(__dirname, "../temp/uploads"),
    keepExtensions: true,
  })
  form_data.parse(req, async (err, fields, files) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ message: "Internal server error" })
    }
    try {
      // Get fields from formdata and assign to variables
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
      } = fields

      // define arrays for filenames and file descriptions
      const filenames = fields.filename
      const fileDescriptions = fields.file_description

      // Define required fields for validation
      const requiredFields = [
        "company_username",
        "company_name",
        "contact_number",
        "email",
        "company_description",
        "address",
        "city",
        "state",
        "country",
      ]

      // Check if required fields are empty
      for (const field of requiredFields) {
        if (
          !fields[field] ||
          fields[field].length === 0 ||
          fields[field][0] === ""
        ) {
          // Delete all incomming files from temp/uploads
          cleanTempUploads(files.file)
          return res.status(400).json({ message: `${field} is required` })
        }
      }

      // Validation for contact number is numeric
      if (!contact_number[0].match(/^[0-9]+$/)) {
        // Delete all incomming files from temp/uploads
        cleanTempUploads(files.file)
        return res
          .status(400)
          .json({ message: "Contact number must be numeric" })
      }

      // Validation for email is valid
      if (!email[0].match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        // Delete all incomming files from temp/uploads
        cleanTempUploads(files.file)
        return res.status(400).json({ message: "Email is invalid" })
      }

      // Define required files for validation
      const requiredFiles = ["file"]

      // Check if required files are empty or length less than 1
      for (const file of requiredFiles) {
        if (!files[file] || !files[file].length > 0) {
          console.log("Error in: ", file)
          // Delete all incomming files from temp/uploads
          cleanTempUploads(files.file)

          return res.status(400).json({ message: `${file} is required` })
        }
      }

      // Check file types for all files before proceeding with any uploads
      // to prevent uploading files that are not allowed
      const invalidFiles = files.file.filter(
        (file) => !isFileTypeAllowed(file.mimetype)
      )

      // If there are invalid files
      if (invalidFiles.length > 0) {
        const invalidFileNames = invalidFiles.map(
          (file) => file.originalFilename
        )
        // Delete all incomming files from temp/uploads
        cleanTempUploads(files.file)
        return res.status(400).json({
          message: `Invalid file type for file(s): ${invalidFileNames.join(
            ", "
          )}`,
        })
      }

      // Function to validate array of fields
      // in this case, filenames and file descriptions
      const validateArray = (array, fieldName) => {
        if (!array || array.length === 0) {
          // Delete all incomming files from temp/uploads
          cleanTempUploads(files.file)
          return res.status(400).json({ message: `${fieldName} is required` })
        }
        if (!array.every((item) => item && item.length > 0)) {
          // Delete all incomming files from temp/uploads
          cleanTempUploads(files.file)
          return res.status(400).json({ message: `${fieldName} is required` })
        }
      }

      // Validate filenames and file descriptions
      validateArray(filenames, "Filename")
      validateArray(fileDescriptions, "File description")

      // Check if all file-related arrays have the same length or not
      if (
        files.file.length !== filenames.length ||
        files.file.length !== fileDescriptions.length
      ) {
        // Delete all incomming files from temp/uploads
        cleanTempUploads(files.file)
        return res.status(400).json({
          message:
            "Filename and file description length must match file length",
        })
      }

      console.log(`Trying to register merchant ${company_username[0]}...`)

      // get if merchant already registered by checking company_username or email
      const isMerchantRegistered = await Merchant.exists({
        $or: [{ company_username: company_username[0] }, { email: email[0] }],
      })

      // If merchant already registered, return
      if (isMerchantRegistered) {
        // Delete all incomming files from temp/uploads
        cleanTempUploads(files.file)
        return res.status(400).json({ message: "Merchant already registered" })
      }

      // define documentPromises from files.file array to upload files
      // and return array of objects containing url, filename, and description
      const mvDocument = files.file.map(async (file, i) => {
        const oldpath = file.filepath
        const extension = path.extname(file.originalFilename)
        const filename = `${filenames[i]}-${Date.now()}${extension}`
        const newpath = path.join(__dirname, "../uploads/", filename)

        return mvPromise(oldpath, newpath).then(() => {
          return {
            url: `/uploads/${filename}`,
            filename,
            description: fileDescriptions[i],
          }
        })
      })

      const document = await Promise.all(mvDocument)
      console.log(`Document: ${document.length} files`)

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
        document,
      })

      const savedMerchant = await merchant.save()
      console.log(`Merchant ${company_username[0]} registered successfully`)
      return res.status(200).json(savedMerchant)
    } catch (err) {
      // Delete all incomming files from temp/uploads
      cleanTempUploads(files.file)
      console.error(err)
      return res.status(500).json({ message: "Internal server error" })
    }
  })
})

/**
 * @GET /api/merchant/:id
 * @returns {object} merchant
 * @description Get Merchant data by id
 */
router.get("/merchant/:id", async (req, res) => {
  try {
    const merchant = await Merchant.findOne({ _id: req.params.id })
    const originFrom = ssTunel.isFromTunnel(req.headers.origin)
    merchant.document.forEach((document) => {
      document.url = `${originFrom}${document.url}`
    })
    console.log("Return Merchant:", merchant.company_username)
    res.status(200).json(merchant)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

/**
 * @GET /api/merchant
 * @returns {object} merchant
 * @description Get all merchant data with out pagination
 */
router.get("/merchant_all_without_pagination", async (req, res) => {
  try {
    const merchant = await Merchant.find()
    res.status(200).json(merchant)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

/**
 * @GET /api/products/categories
 * @returns {object} categories
 * @description Get all product categories that are registered in database
 */
router.get("/product/categories", async (req, res) => {
  try {
    const categories = await product_categories.findOne()
    res.status(200).json({ categories: categories.categories })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

/**
 * @GET /api/products
 * @returns {object} products
 * @description Get all products with pagination and search query
 */
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

    const buildQueryString = (params) => {
      return Object.entries(params)
        .filter(([key, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join("&")
    }

    const nextPages =
      page >= totalPages
        ? null
        : `${originFrom}/api/products?${buildQueryString({
            page: page ? page + 1 : 2,
            page_size: page_size || 10,
            search: search || "",
            categories: categories || "",
            min_price: min_price || 0,
            max_price: max_price || 0,
          })}`

    const prevPages =
      page === 1
        ? null
        : `${originFrom}/api/products?${buildQueryString({
            page: page ? page - 1 : 1,
            page_size: page_size || 10,
            search: search || "",
            categories: categories || "",
            min_price: min_price || 0,
            max_price: max_price || 0,
          })}`

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

/**
 * @GET /api/products/:id
 * @returns {object} product
 * @description Get product by id
 */
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
      {
        $lookup: {
          from: "reviews",
          localField: "_id",
          foreignField: "product_id",
          as: "reviews",
          pipeline: [
            {
              $lookup: {
                from: "users",
                localField: "customer_id",
                foreignField: "_id",
                as: "user",
              },
            },
            {
              $sort: { _order: -1 },
            },
          ],
        },
      },
      {
        $addFields: {
          average_rating: { $avg: "$reviews.rating" },
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

/**
 * @GET /api/invoice/:id
 * @returns {object} invoice
 * @description Get invoice by id for public
 */
router.get("/invoice/:id", async (req, res) => {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(400).json({ message: "Id is required." })
    }

    const originFrom = ssTunel.isFromTunnel(req.headers.origin)

    // get invoice from database with aggregate
    const invoice = await Invoice.aggregate([
      {
        // match invoice id
        $match: {
          _id: new mongoose.Types.ObjectId(id),
        },
      },
      {
        // add field payment_url so user can pay the invoice if the invoice is not paid
        $addFields: {
          payment_url: {
            $concat: [
              `https://www.sandbox.paypal.com/checkoutnow?token=`,
              "$response_code",
            ],
          },
        },
      },
      {
        // lookup product from with field product_id from invoice
        $lookup: {
          from: "products",
          localField: "product_id",
          foreignField: "_id",
          as: "product",
          // lookup product pictures from product
          pipeline: [
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
          ],
        },
      },
      {
        // lookup user from with field customer_id from invoice
        $lookup: {
          from: "users",
          localField: "customer_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        // lookup merchant from with field merchant_id from invoice
        $lookup: {
          from: "merchants",
          localField: "merchant_id",
          foreignField: "_id",
          as: "merchant",
        },
      },
    ])

    // check if invoice is empty, if empty return 404
    if (invoice.length === 0) {
      return res.status(404).json({ message: "Invoice not found" })
    }

    // replace pictures url with backend url
    invoice[0].product.forEach((product) => {
      product.pictures.forEach((picture) => {
        picture.url = `${originFrom}${picture.url}`
      })
    })

    console.log("Return Invoice:", invoice[0]._id.toString())
    res.status(200).json(invoice[0])
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

module.exports = router
