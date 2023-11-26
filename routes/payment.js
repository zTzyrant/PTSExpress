require("dotenv").config()
const express = require("express")
const payment = express.Router()
const authFunction = require("../functions/authFunction")
const Users = require("../models/users")
const Products = require("../models/products")
const Merchant = require("../models/merchant")
const axios = require("axios")
const exchange = require("../functions/ratesExchange")
const Invoice = require("../models/invoice")
const ssTunel = require("../functions/routeFrom")

/**
 * Generate an OAuth 2.0 access token for authenticating with PayPal REST APIs.
 * @see https://developer.paypal.com/api/rest/authentication/
 */
async function getAccessToken() {
  try {
    if (!process.env.PAYPAL_CID || !process.env.PAYPAL_SECRET) {
      throw new Error("MISSING_API_CREDENTIALS")
    }
    const response = await axios({
      method: "POST",
      url: `${process.env.PAYPAL_ENDPOINT}/v1/oauth2/token`,
      auth: {
        username: process.env.PAYPAL_CID,
        password: process.env.PAYPAL_SECRET,
      },
      data: "grant_type=client_credentials",
    })
    const data = await response.data
    return data.access_token
  } catch (error) {
    console.error("Failed to generate Access Token:", error)
  }
}

/**
 * Create an order to start the transaction.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_create
 */
const createOrder = async (payload) => {
  // using payload to pass the orders information
  console.log("createOrder payload:", payload)
  const access_token = await getAccessToken()
  const response = await axios({
    method: "POST",
    url: `${process.env.PAYPAL_ENDPOINT}/v2/checkout/orders`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access_token}`,
    },
    data: payload,
  })
  return handleResponse(response)
}

/**
 * Capture an order payment by passing the approved order ID.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_capture
 * @param {String} orderID
 * @returns {Object} Capture response
 **/
const captureOrder = async (orderID) => {
  const access_token = await getAccessToken()
  const response = await axios({
    method: "POST",
    url: `${process.env.PAYPAL_ENDPOINT}/v2/checkout/orders/${orderID}/capture`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access_token}`,
    },
  })
  return handleResponse(response)
}

const getOrders = async (id) => {
  const access_token = await getAccessToken()
  const response = await axios({
    method: "GET",
    url: `${process.env.PAYPAL_ENDPOINT}/v2/checkout/orders/${id}`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access_token}`,
    },
  })
  return handleResponse(response)
}

/**
 * Handle response from PayPal API
 * @param {Object} response
 * @returns {Object} Status code and response
 * @throws Error
 **/
async function handleResponse(response) {
  try {
    const jsonResponse = await response.data
    return {
      jsonResponse,
      httpStatusCode: response.status,
    }
  } catch (err) {
    const errorMessage = await response.text()
    throw new Error(errorMessage)
  }
}

payment.use("/getAccess", async (req, res, next) => {
  try {
    const errorr = await createOrder()
    res.status(200).json({ message: "success" })
  } catch (error) {
    console.error("Failed to create order:", error.code ? error.code : error)
    res.status(500).json({ error: "Failed to capture order." })
  }
})

payment.use("/", async (req, res, next) => {
  if (req.method === "POST") {
    if (req.headers["authorization"]) {
      try {
        const token = req.headers["authorization"].split(" ")[1]
        const decoded = await authFunction.verifyToken(token)
        if (decoded) {
          const customer = await Users.findOne({
            _id: decoded.id,
          })
          console.log(customer)
          if (customer && customer.is_customer) {
            next()
          } else {
            throw {
              message: `You are not authorized to access this route`,
              status: false,
            }
          }
        } else {
          throw {
            message: `Invalid token`,
            status: false,
          }
        }
      } catch (err) {
        res.status(500).json({
          message: err.message,
        })
      }
    } else {
      res.status(401).json({ message: "Unauthorized" })
    }
  } else {
    next()
  }
})

payment.get("/", (req, res) => {
  res.status(200).json({ message: "success" })
})

payment.post("/invoice", async (req, res) => {
  const { date_travel, number_of_guest, note, product_id } = req.body
  if (!date_travel) {
    res.status(500).json({ message: "Date travel is required" })
    return false
  }
  if (!number_of_guest) {
    res.status(500).json({ message: "Number of guest is required" })
    return false
  }
  if (!note) {
    res.status(500).json({ message: "Note is required" })
    return false
  }
  if (!product_id) {
    res.status(500).json({ message: "Product id is required" })
    return false
  }

  try {
    const token = req.headers["authorization"].split(" ")[1]
    const decoded = await authFunction.verifyToken(token)
    const customer = await Users.findOne({
      _id: decoded.id,
    })
    console.log(product_id)
    const products = await Products.findOne({ _id: product_id })
    if (products && products.number_of_guests <= !number_of_guest) {
      throw {
        message: `Number of guest must be less than or equal to ${products.number_of_guests}`,
        status: false,
      }
    }
    const merchant = await Merchant.findOne({ _id: products.merchant_id })
    if (products && merchant) {
      const { amount_usd, amount_myr, rate_myr } = await exchange.ratesExchange(
        products.price
      )
      const invoice = await Invoice.create({
        // invoice
        date_travel,
        number_of_guest,
        note,

        // amount
        amount_usd,
        amount_myr,
        rate: rate_myr,

        //
        status: "pending",
        response_code: null,
        response_stringify: null,

        // Foreign key but not referenced
        customer_id: customer._id,
        merchant_id: merchant._id,
        product_id: products._id,
      })
      if (Invoice) {
        res
          .status(200)
          .json({ message: "success create order in database", invoice })
      } else {
        throw {
          message: `Failed to create invoice`,
          status: false,
        }
      }
    } else {
      throw {
        message: `Product not found`,
        status: false,
      }
    }
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

payment.post("/invoice/:id/pay", async (req, res) => {
  const { id } = req.params
  if (!id) {
    res.status(500).json({ message: "Invoice id is required" })
    return false
  }

  try {
    const invoice = await Invoice.findOne({ _id: id })
    if (!invoice) {
      res.status(500).json({ message: "Invoice not found" })
      return false
    }
    const products = await Products.findOne({ _id: invoice.product_id })
    if (!products) {
      res.status(500).json({ message: "Product not found" })
      return false
    }

    const originFrom = ssTunel.isFromTunnel(req.headers.origin)
    const payment_body = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: `PTS-${invoice._id}-${Date.now()}`,
          description: `Payment for ${invoice.product_id}`,
          items: [
            {
              name: `${products.name}`,
              description: `Payment for product ${products.name}`,
              quantity: "1",
              unit_amount: {
                currency_code: "USD",
                value: invoice.amount_usd,
              },
            },
          ],
          amount: {
            currency_code: "USD",
            value: invoice.amount_usd,
            breakdown: {
              item_total: {
                currency_code: "USD",
                value: invoice.amount_usd,
              },
            },
          },
        },
      ],
      application_context: {
        brand_name: "PTS Merchant Payment",
        shipping_preference: "NO_SHIPPING",
        return_url: `${originFrom}/payment/invoice/${invoice._id}/capture`,
        cancel_url: `${process.env.FE_HOST}/orders`,
      },
    }

    const { jsonResponse, httpStatusCode } = await createOrder(payment_body)
    console.log(httpStatusCode)
    const update_invoice = await Invoice.findOneAndUpdate(invoice._id, {
      status: "unpaid",
      response_code: jsonResponse.id,
      response_stringify: JSON.stringify(jsonResponse),
    })

    const new_invoice = await Invoice.findOne({ _id: invoice._id })

    res.status(httpStatusCode).json({
      message: "success create order payment in paypal",
      payment: jsonResponse,
      invoice: new_invoice,
      payment_url: `https://www.sandbox.paypal.com/checkoutnow?token=${jsonResponse.id}`,
    })
  } catch (error) {
    console.error("Failed to create order:", error.code ? error.code : error)
    console.log(error.response.data)
    res.status(500).json({ error: "Failed to create order.", response: error })
  }
})

/**
 * Capture an order payment by passing the approved order ID.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_capture
 * @param {String} invoice_id
 * @returns {Object} Capture response
 **/
payment.get("/invoice/:id/capture", async (req, res) => {
  try {
    const { id } = req.params
    if (!id) {
      res.status(500).json({ message: "Invoice id is required" })
      return false
    }
    const invoice = await Invoice.findOne({ _id: id })
    if (!invoice) {
      res.status(500).json({ message: "Invoice not found" })
      return false
    }
    const isApproveOrder = await getOrders(invoice.response_code)
    if (!isApproveOrder) {
      res.status(500).json({ message: "Order not found" })
      return false
    }
    console.log(isApproveOrder.jsonResponse)

    if (isApproveOrder.jsonResponse.status !== "APPROVED") {
      res.status(500).json({ message: "Order not approved" })
      return false
    }

    const { jsonResponse, httpStatusCode } = await captureOrder(
      invoice.response_code
    )

    const update_invoice = await Invoice.findOneAndUpdate(invoice._id, {
      status: "paid",
      response_code: jsonResponse.id,
      response_stringify: JSON.stringify(jsonResponse),
    })

    // res.status(httpStatusCode).json({ jsonResponse, invoice: update_invoice })

    // return to frontend
    res.redirect(`${process.env.FE_HOST}/orders`)
  } catch (error) {
    console.error("Failed to capture order:", error.code ? error.code : error)
    res.status(500).json({ error: "Failed to capture order." })
  }
})

/**
 * Get order details by passing the approved order ID from invoice response_code
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_get
 * @param {String} invoice_id
 * @returns {Object} Order details
 * @throws Error
 **/
payment.get("/invoice/:id", async (req, res) => {
  const { id } = req.params
  if (!id) {
    return res.status(500).json({ message: "Invoice id is required" })
  }

  try {
    const invoice = await Invoice.findOne({ _id: id })
    console.log(invoice)
    if (!invoice) {
      return res.status(500).json({ message: "Invoice not found" })
    }
    const { jsonResponse, httpStatusCode } = await getOrders(
      invoice.response_code
    )
    console.log(jsonResponse)
    res.status(httpStatusCode).json(jsonResponse)
  } catch (error) {
    console.log(error.response.data)
    if (error.response.data.details[0].issue === "INVALID_RESOURCE_ID") {
      const update_invoice = await Invoice.findOneAndUpdate(
        { _id: id },
        {
          status: "expired",
        }
      )
      return res.status(500).json({
        message: "Order was expired",
        status: "expired",
        details: "Your Payment link has been expired.",
      })
    }
    console.error("Failed to get order data:", error.code ? error.code : error)
    res.status(500).json({ error: "Failed to get order data." })
  }
})

module.exports = payment
