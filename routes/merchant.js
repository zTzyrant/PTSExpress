require("dotenv").config()
const express = require("express")
const merchant = express.Router()
const Products = require("../models/products")
const Product_Pictures = require("../models/product_pictures")
const picture_upload = require("../functions/picture_upload")
const mongoose = require("mongoose")
const ssTunel = require("../functions/routeFrom")
const Invoice = require("../models/invoice")
const Merchant = require("../models/merchant")
const { merchantAuth } = require("../middleware/merchantAuth")

/**
 * @function validateProduct
 * @param {Object} req
 * @returns {Object} message
 * @description validate product from request body
 */
validateProduct = (req) => {
  switch (true) {
    case !req.body.name:
      return { message: "Name is required" }
    case !req.body.price:
      return { message: "Price is required" }
    case req.body.price < 10:
      return { message: "Price must be greater than 10 MYR" }
    case !req.body.number_of_guests || req.body.number_of_guests < 1:
      return { message: "Number of guests is required" }
    case !req.body.limit_order || req.body.limit_order < 1:
      return { message: "Limit order is required" }
    case !req.body.categories || req.body.categories.length === 0:
      return { message: "Categories is required" }
    case !req.body.address:
      return { message: "Address is required" }
    case !req.body.city:
      return { message: "City is required" }
    case !req.body.state:
      return { message: "State is required" }
    case !req.body.post_code:
      return { message: "Post code is required" }
    case !req.body.country:
      return { message: "Country is required" }
    case !req.body.description:
      return { message: "Description is required" }
    default:
      return null
  }
}

/**
 * @function deletePictures
 * @param {Array} pictures
 * @returns {Object} message
 * @description delete pictures from database by id
 */
const deletePictures = async (pictures) => {
  try {
    await Product_Pictures.deleteMany({ _id: { $in: pictures } })
  } catch (err) {
    throw err
  }
}

/**
 * @path /merchant/
 * @method GET
 * @description get merchant server status
 * @middleware merchantAuth
 * @returns {Object} message
 */
merchant.get("/", merchantAuth, async (req, res) => {
  console.log("Time:", Date.now())
  res.status(200).json({
    message: "Merchant server is running",
    time: Date.now(),
    user: req.user.fullname,
  })
})

/**
 * @path /merchant/products
 * @method GET
 * @description get all products by merchant id
 * @middleware merchantAuth
 * @returns {Object} products
 */
merchant.get("/products", merchantAuth, async (req, res) => {
  try {
    const decoded = req.user
    const products = await Products.aggregate([
      // Match products by merchant_id
      {
        $match: {
          merchant_id: decoded.merchant_id,
        },
      },
      // Convert local id field to string
      {
        $addFields: {
          productIdString: { $toString: "$_id" }, // Convert local id field to string
        },
      },
      // Lookup product_pictures by product_id
      {
        $lookup: {
          from: "product_pictures",
          localField: "productIdString",
          foreignField: "product_id",
          as: "pictures",
        },
      },
    ])
    if (products.length === 0) {
      // if no products just return empty array of object
      res.status(200).json({ products })
    } else {
      // if products found then return products with pictures
      const originFrom = ssTunel.isFromTunnel(req.headers.origin)
      products.forEach((product) => {
        // set backend host url to pictures host url
        product.pictures.forEach((picture) => {
          picture.url = `${originFrom}${picture.url}`
        })
      })
      res.json(products)
    }
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

/**
 * @path /merchant/products/:id
 * @method GET
 * @description get product by id
 * @middleware merchantAuth
 * @returns {Object} product
 */
merchant.get("/products/:id", merchantAuth, async (req, res) => {
  try {
    const decoded = req.user
    console.log("Merchant id:", decoded.merchant_id)
    const product = await Products.aggregate([
      // Match products by merchant_id
      {
        $match: {
          $and: [
            { _id: new mongoose.Types.ObjectId(req.params.id) },
            { merchant_id: decoded.merchant_id },
          ],
        },
      },
      // Convert local id field to string
      {
        $addFields: {
          productIdString: { $toString: "$_id" }, // Convert local id field to string
        },
      },
      // Lookup product_pictures by product_id
      {
        $lookup: {
          from: "product_pictures",
          localField: "productIdString",
          foreignField: "product_id",
          as: "pictures",
        },
      },
    ])

    if (product.length === 0) {
      return res.status(404).json({ message: "Product not found" })
    }

    // if products found then return products with pictures
    const originFrom = ssTunel.isFromTunnel(req.headers.origin)
    // set backend host url to pictures host url
    product[0].pictures.forEach((picture) => {
      picture.url = `${originFrom}${picture.url}`
    })
    res.json(product[0])
  } catch (err) {
    console.log(err)
    res.status(500).json({ message: err.message })
  }
})

/**
 * @path /merchant/products
 * @method POST
 * @description create new product
 * @middleware merchantAuth
 * @returns {Object} product
 */
merchant.post("/products", merchantAuth, async (req, res) => {
  if (validateProduct(req)) return res.status(400).json(validateProduct(req))

  const {
    name,
    price,
    number_of_guests,
    limit_order,
    hotel_grade,
    categories,
    include_wifi,
    include_foods,
    include_hotel,
    include_transportation,
    address,
    city,
    state,
    post_code,
    country,
    description,
  } = req.body

  try {
    const decoded = req.user
    const newProduct = new Products({
      // product
      merchant_id: decoded.merchant_id,
      name: name,
      price: price,
      number_of_guests: number_of_guests,
      limit_order: limit_order,
      hotel_grade: Number(hotel_grade),
      categories: categories,
      // facilities
      include_wifi: include_wifi,
      include_foods: include_foods,
      include_hotel: include_hotel,
      include_transportation: include_transportation,
      // address destination or products
      address: address,
      city: city,
      state: state,
      post_code: post_code,
      country: country,
      // descriptions
      description: description,
    })
    await newProduct.save()
    res.json(newProduct)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

/**
 * @path /merchant/products/:id/picture/upload
 * @method PUT
 * @description upload product pictures
 * @middleware merchantAuth
 * @returns {Object} productPictures
 */
merchant.put("/products/:id/picture/upload", merchantAuth, async (req, res) => {
  try {
    const decoded = req.user
    const product = await Products.findById(req.params.id)
    if (product.merchant_id !== decoded.merchant_id) {
      return res.status(403).json({ message: "Forbidden, not your product" })
    }
    const { files } = await picture_upload.handleFormData(req)
    if (!files.pictures) {
      return res.status(500).json({ message: "Error with your files" })
    }

    // validate image type
    const validateImageType = (picture) => {
      const imageType = /^image\/(jpeg|png|jpg)$/
      return imageType.test(picture.mimetype)
    }

    // check if all files are image type and throw error if not
    if (!files.pictures.every(validateImageType)) {
      throw {
        message: "Only jpeg, png, jpg image type is allowed",
      }
    }

    // check if all files are less than 5 MB and throw error if not
    if (!files.pictures.every((picture) => picture.size <= 5000000)) {
      throw {
        message: "File size must be less than 5 MB",
      }
    }

    // upload pictures to server, using formidable
    const uploadedPictures = await picture_upload.uploadPicture(files)

    // check if all pictures are uploaded and throw error if not
    if (!uploadedPictures || uploadedPictures.length === 0) {
      return res.status(500).json({ message: "Error while uploading pictures" })
    }

    // create productPictures array to save pictures info
    const productPictures = uploadedPictures.map((picture) => ({
      product_id: req.params.id,
      url: picture.url,
      filename: picture.filename,
      size: picture.size,
    }))

    // then save {many} productPictures to database
    const savedProductPictures = await Product_Pictures.insertMany(
      productPictures
    )

    res.status(201).json(savedProductPictures)
  } catch (err) {
    console.error("Upload picture error:", err)
    res.status(500).json({ message: err.message })
  }
})

// this end point only delete one picture
merchant.delete("/products/:id/picture", merchantAuth, async (req, res) => {
  try {
    const decoded = req.user
    const product = await Products.findById(req.params.id)
    if (product.merchant_id === decoded.merchant_id) {
      await Product_Pictures.findByIdAndDelete(req.params.picture_id)
      res.json({ message: "Product picture deleted" })
    } else {
      res.status(403).json({ message: "Forbidden not your product" })
    }
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// this end point delete multiple pictures
merchant.patch(
  "/products/:id/picture/remove",
  merchantAuth,
  async (req, res) => {
    const { picture } = req.body
    if (!picture || picture.length <= 0) {
      return res.status(400).json({ message: "Picture id is required" })
    }

    try {
      const decoded = req.user
      const product = await Products.findById(req.params.id)
      console.log("product id:", product.merchant_id)
      console.log("decoded id:", decoded.merchant_id)
      if (product.merchant_id === decoded.merchant_id) {
        await deletePictures(picture)
        res.status(200).json({ message: "Product picture deleted" })
      } else {
        res.status(403).json({ message: "Forbidden not your product" })
      }
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  }
)

/**
 * @path /merchant/products/:id/picture
 * @method GET
 * @description get product pictures by product id
 * @middleware merchantAuth
 * @returns {Object} productPictures
 */
merchant.get("/products/:id/picture", merchantAuth, async (req, res) => {
  try {
    const decoded = req.user
    const product = await Products.findById(req.params.id)
    if (product.merchant_id === decoded.merchant_id) {
      const productPictures = await Product_Pictures.find({
        product_id: req.params.id,
      })
      res.json(productPictures)
    } else {
      res.status(403).json({ message: "Forbidden not your product" })
    }
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

/**
 * @path /merchant/products/:id
 * @method PUT
 * @description update product by id
 * @middleware merchantAuth
 * @returns {Object} product
 */
merchant.put("/products/:id", merchantAuth, async (req, res) => {
  if (validateProduct(req)) return res.status(400).json(validateProduct(req))

  const {
    name,
    price,
    number_of_guests,
    limit_order,
    hotel_grade,
    categories,
    include_wifi,
    include_foods,
    include_hotel,
    include_transportation,
    address,
    city,
    state,
    post_code,
    country,
    description,
  } = req.body

  try {
    const decoded = req.user
    const product = await Products.findById(req.params.id)
    console.log("merchant id (product):", product.merchant_id)
    console.log("merchant id (decoded):", decoded.merchant_id)
    if (product.merchant_id !== decoded.merchant_id) {
      return res.status(403).json({ message: "Forbidden not your product" })
    }

    const updatedProduct = await Products.findByIdAndUpdate(
      req.params.id,
      {
        // product
        name: name,
        price: price,
        number_of_guests: number_of_guests,
        limit_order: limit_order,
        hotel_grade: Number(hotel_grade),
        categories: categories,
        // facilities
        include_wifi: include_wifi,
        include_foods: include_foods,
        include_hotel: include_hotel,
        include_transportation: include_transportation,
        // address destination or products
        address: address,
        city: city,
        state: state,
        post_code: post_code,
        country: country,
        // descriptions
        description: description,
      },
      { new: true }
    )
    res.json(updatedProduct)
  } catch (err) {
    console.log(err)
    res.status(500).json({ message: err.message })
  }
})

/**
 * @path /merchant/products/:id
 * @method DELETE
 * @description delete product by id
 * @middleware merchantAuth
 */
merchant.delete("/products/:id", merchantAuth, async (req, res) => {
  try {
    const decoded = req.user
    const product = await Products.findById(req.params.id)
    if (product.merchant_id === decoded.merchant_id) {
      await Products.findByIdAndDelete(req.params.id)
      await Product_Pictures.deleteMany({ product_id: req.params.id })
      res.json({ message: "Product deleted" })
    } else {
      res.status(403).json({ message: "Forbidden not your product" })
    }
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

/**
 * @path /merchant/orders
 * @method GET
 * @description get all orders by merchant id
 * @middleware merchantAuth
 * @returns {Object} orders
 */
merchant.get("/orders", merchantAuth, async (req, res) => {
  try {
    const decoded = req.user
    const invoice = await Invoice.aggregate([
      {
        $match: {
          $and: [
            {
              merchant_id: new mongoose.Types.ObjectId(decoded.merchant_id),
            },
            { status: "paid" },
          ],
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "product_id",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "customer_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $project: {
          user: {
            password: 0,
          },
        },
      },
    ])

    res.json(invoice)
  } catch (err) {
    console.log("get orders error", err)
    res.status(500).json({ message: err.message })
  }
})

/**
 * @path /merchant/top_product
 * @method GET
 * @description get top product by merchant id
 * @middleware merchantAuth
 * @returns {Object} topProducts
 */
merchant.get("/top_product", merchantAuth, async (req, res) => {
  const { limit } = req.query
  try {
    const decoded = req.user
    const merchant = await Merchant.findById(decoded.merchant_id)
    if (!merchant) {
      return res.status(404).json({ message: "Merchant not found" })
    }

    const topProducts = await Products.aggregate([
      {
        $match: merchant._id ? { merchant_id: merchant._id.toString() } : {},
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
    const products = limit ? topProducts.slice(0, limit) : topProducts
    res.json(products)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

/**
 * @path /merchant/product/statistic
 * @method GET
 * @description get product statistic by merchant id
 * @middleware merchantAuth
 * @returns {Object} statistic
 */
merchant.get("/product/statistic", merchantAuth, async (req, res) => {
  try {
    const decoded = req.user
    const merchant = await Merchant.findById(decoded.merchant_id)
    if (merchant && decoded) {
      const invoice = await Invoice.aggregate([
        {
          $match: {
            $and: [{ merchant_id: merchant._id }, { status: "paid" }],
          },
        },
      ])
      const total_product = await Products.find({
        merchant_id: merchant._id.toString(),
      }).countDocuments()
      const product = await Products.aggregate([
        {
          $match: {
            merchant_id: merchant._id.toString(),
          },
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

      const top_product = product.length >= 1 ? product[0].name : null
      const total_sold = invoice.length
      const total_amount = invoice
        .map((item) => item.amount_myr)
        .reduce((a, b) => a + b, 0)
      console.log("total sold:", total_sold)
      console.log("total amount:", total_amount)
      res
        .status(200)
        .json({ total_sold, total_amount, total_product, top_product })
    } else {
      return res.status(404).json({ message: "Merchant not found" })
    }
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: error.message })
  }
})

module.exports = merchant
