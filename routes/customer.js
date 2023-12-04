require("dotenv").config()
const express = require("express")
const customer = express.Router()
const mongoose = require("mongoose")
const ssTunel = require("../functions/routeFrom")
const Invoice = require("../models/invoice")
const Review = require("../models/review")
const User = require("../models/users")
const { customerAuth } = require("../middleware/customerAuth")

/**
 * @path /customer/my_order
 * @method GET
 * @returns {Array} invoices (orders)
 * @description Get all invoices or orders of a customer
 */
customer.get("/my_order", customerAuth, async (req, res) => {
  const decoded = req.user

  try {
    const user = await User.findOne({ _id: decoded.id })
    const invoices = await Invoice.aggregate([
      { $match: { customer_id: new mongoose.Types.ObjectId(user._id) } },
      {
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
        $lookup: {
          from: "products",
          localField: "product_id",
          foreignField: "_id",
          as: "product",

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
      { $sort: { _id: -1 } },
    ])
    const originFrom = ssTunel.isFromTunnel(req.headers.origin)
    // rewrite url to be accessible from client so that client can access the image
    // either from local or from tunnel
    const updatedInvoices = invoices.map((invoice) => ({
      ...invoice,
      product: invoice.product.map((product) => ({
        ...product,
        pictures: product.pictures.map((picture) => ({
          ...picture,
          url: `${originFrom}${picture.url}`,
        })),
      })),
    }))
    res.status(200).json(updatedInvoices)
  } catch (error) {
    console.log("error", error.message ? error.message : error)
    res.status(500).json({ message: "Internal server error" })
  }
})

/**
 * @path /customer/my_order/review
 * @method GET
 * @returns {Array} invoices (orders)
 * @description Get all invoices or orders of a customer
 */
customer.get("/my_order/review", customerAuth, async (req, res) => {
  const decoded = req.user
  try {
    const user = await User.findOne({ _id: decoded.id })
    const invoices = await Invoice.aggregate([
      {
        $match: {
          $and: [
            { customer_id: new mongoose.Types.ObjectId(user._id) },
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
        $lookup: {
          from: "reviews",
          localField: "_id",
          foreignField: "invoice_id",
          as: "review",
        },
      },
      { $sort: { _id: -1 } },
    ])
    const originFrom = ssTunel.isFromTunnel(req.headers.origin)
    // rewrite url to be accessible from client so that client can access the image
    // either from local or from tunnelconst
    updatedInvoices = invoices.map((invoice) => ({
      ...invoice,
      product: invoice.product.map((product) => ({
        ...product,
        pictures: product.pictures.map((picture) => ({
          ...picture,
          url: `${originFrom}${picture.url}`,
        })),
      })),
    }))

    console.log("Get Invoice:", updatedInvoices.length)
    res.status(200).json(updatedInvoices)
  } catch (error) {
    console.log("error", error.message ? error.message : error)
    res.status(500).json({ message: "Internal server error" })
  }
})

/**
 * @path /customer/my_order/review/:id
 * @method POST
 * @returns {Object} review
 * @description Post a review for a product
 */
customer.post("/my_order/review/:id", customerAuth, async (req, res) => {
  const { rating, comment, is_recommend } = req.body
  const { id } = req.params
  if (!id) {
    return res.status(400).json({ message: "Invoice id is required" })
  }
  if (!rating) {
    return res.status(400).json({ message: "Rating is required" })
  }
  if (!comment) {
    return res.status(400).json({ message: "Comment is required" })
  }
  const decoded = req.user

  try {
    const invoice = await Invoice.findOne({ _id: id, customer_id: decoded.id })
    if (!invoice) {
      return res.status(400).json({ message: "Invoice not found" })
    }
    if (invoice.status !== "paid") {
      return res.status(400).json({ message: "Invoice status is not paid" })
    }
    const review = new Review({
      invoice_id: invoice._id,
      customer_id: invoice.customer_id,
      merchant_id: invoice.merchant_id,
      product_id: invoice.product_id,
      // review
      rating: rating,
      comment: comment,
      is_recommend: is_recommend,
    })
    await review.save()
    res.status(200).json(review)
  } catch (error) {
    console.log("error", error.message ? error.message : error)
    res.status(500).json({ message: "Internal server error" })
  }
})

module.exports = customer
