require("dotenv").config()
const express = require("express")
const merchant = express.Router()
const authFunction = require("../functions/authFunction")
const Products = require("../models/products")
const Product_Pictures = require("../models/product_pictures")
const picture_upload = require("../functions/picture_upload")
const mongoose = require("mongoose")
const ssTunel = require("../functions/routeFrom")
const Invoice = require("../models/invoice")
const Merchant = require("../models/merchant")

merchant.get("/products", async (req, res) => {
  if (req.headers["authorization"]) {
    try {
      const token = req.headers["authorization"].split(" ")[1]
      const decoded = await authFunction.verifyToken(token)
      console.log(decoded)
      if (decoded.is_merchant) {
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
        console.log(products)
        if (products.length === 0) {
          res.status(200).json({ products })
        } else {
          const originFrom = ssTunel.isFromTunnel(req.headers.origin)

          products.forEach((product) => {
            product.pictures.forEach((picture) => {
              picture.url = `${originFrom}${picture.url}`
            })
          })
          res.json(products)
        }
      } else {
        res.status(403).json({ message: "Forbidden not merchant" })
      }
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  } else {
    res.status(401).json({ message: "Unauthorized" })
  }
})

merchant.get("/products/:id", async (req, res) => {
  if (req.headers["authorization"]) {
    try {
      const token = req.headers["authorization"].split(" ")[1]
      const decoded = await authFunction.verifyToken(token)
      if (decoded.is_merchant) {
        const product = await Products.aggregate([
          // Match products by merchant_id
          {
            $match: {
              _id: new mongoose.Types.ObjectId(req.params.id),
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
        if (product[0].merchant_id === decoded.merchant_id) {
          console.log(req.headers.origin)
          const originFrom = ssTunel.isFromTunnel(req.headers.origin)
          product[0].pictures.forEach((picture) => {
            picture.url = `${originFrom}${picture.url}`
          })
          res.json(product[0])
        } else {
          console.log(product.merchant_id, decoded.merchant_id)
          res.status(403).json({ message: "Forbidden not your product" })
        }
      } else {
        res.status(403).json({ message: "Forbidden not merchant" })
      }
    } catch (err) {
      console.log(err)
      res.status(500).json({ message: err.message })
    }
  } else {
    res.status(401).json({ message: "Unauthorized" })
  }
})

merchant.post("/products", async (req, res) => {
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

  // if (
  //   name &&
  //   price > 10_000 &&
  //   number_of_guests > 0 &&
  //   limit_order > 0 &&
  //   categories.length > 0 &&
  //   address &&
  //   city &&
  //   state &&
  //   post_code &&
  //   country &&
  //   description
  // )
  if (req.headers["authorization"]) {
    try {
      const token = req.headers["authorization"].split(" ")[1]
      const decoded = await authFunction.verifyToken(token)
      if (decoded.is_merchant) {
        // checking required fields start
        if (!name) {
          return res.status(400).json({ message: "Name is required" })
        }
        if (!price) {
          return res.status(400).json({ message: "Price is required" })
        }
        if (price < 10) {
          return res
            .status(400)
            .json({ message: "Price must be greater than 10 MYR" })
        }
        if (!number_of_guests || number_of_guests < 1) {
          return res
            .status(400)
            .json({ message: "Number of guests is required" })
        }
        if (!limit_order || limit_order < 1) {
          return res.status(400).json({ message: "Limit order is required" })
        }
        if (!categories || categories.length === 0) {
          return res.status(400).json({ message: "Categories is required" })
        }
        if (!address) {
          return res.status(400).json({ message: "Address is required" })
        }
        if (!city) {
          return res.status(400).json({ message: "City is required" })
        }
        if (!state) {
          return res.status(400).json({ message: "State is required" })
        }
        if (!post_code) {
          return res.status(400).json({ message: "Post code is required" })
        }
        if (!country) {
          return res.status(400).json({ message: "Country is required" })
        }
        if (!description) {
          return res.status(400).json({ message: "Description is required" })
        }
        // checking required fields end
        console.log(decoded)
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
      } else {
        res.status(403).json({ message: "Forbidden not merchant" })
      }
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  } else {
    res.status(401).json({ message: "Unauthorized" })
  }
})

merchant.put("/products/:id/picture/upload", async (req, res) => {
  if (req.headers["authorization"]) {
    try {
      const token = req.headers["authorization"].split(" ")[1]
      const decoded = await authFunction.verifyToken(token)
      if (decoded.is_merchant) {
        const product = await Products.findById(req.params.id)
        if (product.merchant_id === decoded.merchant_id) {
          const { files } = await picture_upload.handleFormData(req)
          if (files.pictures) {
            const uploadedPictures = await picture_upload.uploadPicture(files)
            if (uploadedPictures) {
              const productPictures = []
              uploadedPictures.forEach((picture) => {
                productPictures.push({
                  product_id: req.params.id,
                  url: picture.url,
                  filename: picture.filename,
                  size: picture.size,
                })
              })
              const savedProductPictures = await Product_Pictures.insertMany(
                productPictures
              )
              res.json(savedProductPictures)
            } else {
              res
                .status(500)
                .json({ message: "Error while uploading pictures" })
            }
          } else {
            res.status(500).json({ message: "Error with your files" })
          }
        } else {
          res.status(403).json({ message: "Forbidden not your product" })
        }
      } else {
        res.status(403).json({ message: "Forbidden not merchant" })
      }
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  } else {
    res.status(401).json({ message: "Unauthorized" })
  }
})

merchant.delete("/products/:id/picture/", async (req, res) => {
  if (req.headers["authorization"]) {
    try {
      const token = req.headers["authorization"].split(" ")[1]
      const decoded = await authFunction.verifyToken(token)
      if (decoded.is_merchant) {
        const product = await Products.findById(req.params.id)
        if (product.merchant_id === decoded.merchant_id) {
          await Product_Pictures.findByIdAndDelete(req.params.picture_id)
          res.json({ message: "Product picture deleted" })
        } else {
          res.status(403).json({ message: "Forbidden not your product" })
        }
      } else {
        res.status(403).json({ message: "Forbidden not merchant" })
      }
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  } else {
    res.status(401).json({ message: "Unauthorized" })
  }
})

merchant.patch("/products/:id/picture/remove", async (req, res) => {
  if (req.headers["authorization"]) {
    const { picture } = req.body
    if (picture) {
      try {
        const token = req.headers["authorization"].split(" ")[1]
        const decoded = await authFunction.verifyToken(token)
        if (decoded.is_merchant) {
          const product = await Products.findById(req.params.id)
          if (product.merchant_id === decoded.merchant_id) {
            for (let i = 0; i < picture.length; i++) {
              await Product_Pictures.findByIdAndDelete(picture[i])
              if (i === picture.length - 1) {
                res.json({ message: "Product picture deleted" })
              }
            }
          } else {
            res.status(403).json({ message: "Forbidden not your product" })
          }
        } else {
          res.status(403).json({ message: "Forbidden not merchant" })
        }
      } catch (err) {
        res.status(500).json({ message: err.message })
      }
    }
  } else {
    res.status(401).json({ message: "Unauthorized" })
  }
})

merchant.get("/products/:id/picture", async (req, res) => {
  if (req.headers["authorization"]) {
    try {
      const token = req.headers["authorization"].split(" ")[1]
      const decoded = await authFunction.verifyToken(token)
      if (decoded.is_merchant) {
        const product = await Products.findById(req.params.id)
        if (product.merchant_id === decoded.merchant_id) {
          const productPictures = await Product_Pictures.find({
            product_id: req.params.id,
          })
          res.json(productPictures)
        } else {
          res.status(403).json({ message: "Forbidden not your product" })
        }
      } else {
        res.status(403).json({ message: "Forbidden not merchant" })
      }
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  } else {
    res.status(401).json({ message: "Unauthorized" })
  }
})

merchant.put("/products/:id", async (req, res) => {
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

  if (!name) {
    return res.status(400).json({ message: "Name is required" })
  }
  if (!price) {
    return res.status(400).json({ message: "Price is required" })
  }
  if (!number_of_guests || number_of_guests < 1) {
    return res.status(400).json({ message: "Number of guests is required" })
  }
  if (!limit_order || limit_order < 1) {
    return res.status(400).json({ message: "Limit order is required" })
  }
  if (!categories || categories.length === 0) {
    return res.status(400).json({ message: "Categories is required" })
  }
  if (!address) {
    return res.status(400).json({ message: "Address is required" })
  }
  if (!city) {
    return res.status(400).json({ message: "City is required" })
  }
  if (!state) {
    return res.status(400).json({ message: "State is required" })
  }
  if (!post_code) {
    return res.status(400).json({ message: "Post code is required" })
  }
  if (!country) {
    return res.status(400).json({ message: "Country is required" })
  }
  if (!description) {
    return res.status(400).json({ message: "Description is required" })
  }

  if (req.headers["authorization"]) {
    try {
      const token = req.headers["authorization"].split(" ")[1]
      const decoded = await authFunction.verifyToken(token)
      if (decoded.is_merchant) {
        const product = await Products.findById(req.params.id)
        if (product.merchant_id === decoded.merchant_id) {
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
        }
      }
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  } else {
    res.status(401).json({ message: "Unauthorized" })
  }
})

merchant.delete("/products/:id", async (req, res) => {
  if (req.headers["authorization"]) {
    try {
      const token = req.headers["authorization"].split(" ")[1]
      const decoded = await authFunction.verifyToken(token)
      if (decoded.is_merchant) {
        const product = await Products.findById(req.params.id)
        if (product.merchant_id === decoded.merchant_id) {
          await Products.findByIdAndDelete(req.params.id)
          await Product_Pictures.deleteMany({ product_id: req.params.id })
          res.json({ message: "Product deleted" })
        } else {
          res.status(403).json({ message: "Forbidden not your product" })
        }
      } else {
        res.status(403).json({ message: "Forbidden not merchant" })
      }
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  } else {
    res.status(401).json({ message: "Unauthorized" })
  }
})

merchant.get("/orders", async (req, res) => {
  if (req.headers["authorization"]) {
    try {
      const token = req.headers["authorization"].split(" ")[1]
      const decoded = await authFunction.verifyToken(token)

      if (decoded.is_merchant) {
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
        console.log(invoice)

        res.json(invoice)
      } else {
        res.status(403).json({ message: "Forbidden not merchant" })
      }
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  } else {
    res.status(401).json({ message: "Unauthorized" })
  }
})

merchant.get("/top_product", async (req, res) => {
  const { limit } = req.query
  if (req.headers["authorization"]) {
    try {
      const token = req.headers["authorization"].split(" ")[1]
      const decoded = await authFunction.verifyToken(token)
      const merchant = await Merchant.findById(decoded.merchant_id)
      if (merchant && token) {
        const topProducts = await Products.aggregate([
          {
            $match: merchant._id
              ? { merchant_id: merchant._id.toString() }
              : {},
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
      } else {
        return res.status(403).json({ message: "Forbidden not merchant" })
      }
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  } else {
    res.status(401).json({ message: "Unauthorized" })
  }
})

merchant.get("/product/statistic", async (req, res) => {
  if (req.headers["authorization"]) {
    try {
      const token = req.headers["authorization"].split(" ")[1]
      const decoded = await authFunction.verifyToken(token)
      const merchant = await Merchant.findById(decoded.merchant_id)
      console.log(merchant._id)
      if (merchant && token) {
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
        console.log(total_sold, total_amount)
        res
          .status(200)
          .json({ total_sold, total_amount, total_product, top_product })
      }
    } catch (error) {
      console.log(error)
      res.status(500).json({ message: error.message })
    }
  } else {
    res.status(401).json({ message: "Unauthorized" })
  }
})

module.exports = merchant
