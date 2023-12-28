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
const { customerAuth } = require("../middleware/customerAuth")

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

/**
 * Get order details by passing the approved order ID.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_get
 * @param {String} orderID
 * @returns {Object} Order details
 */
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

/**
 * @path /payment
 * @method GET
 * @returns {Object} message
 * @description Test route
 */
payment.get("/", (req, res) => {
  res.status(200).json({ message: "success" })
})

/**
 * @path /payment/invoice
 * @method POST
 * @returns {Object} generated invoice, with message
 * @description Create invoice in database before create order in paypal
 * @description And also check all required fields
 * @description Then convert amount from myr to usd
 * @description Last create invoice in database
 * @scope Use Case 4
 */
payment.post("/invoice", customerAuth, async (req, res) => {
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
    const decoded = req.user
    const customer = await Users.findOne({
      _id: decoded.id,
    })

    // check if product exist
    const products = await Products.findOne({ _id: product_id })

    // if number_of_guest more than products.number_of_guests throw error
    if (products && products.number_of_guests <= !number_of_guest) {
      throw {
        message: `Number of guest must be less than or equal to ${products.number_of_guests}`,
        status: false,
      }
    }

    // check if merchant owner of product
    const merchant = await Merchant.findOne({ _id: products.merchant_id })
    if (!products && !merchant) {
      throw {
        message: `Product not found`,
        status: false,
      }
    }
    // exchange rates from myr to usd
    const { amount_usd, amount_myr, rate_myr } = await exchange.ratesExchange(
      products.price
    )

    // create invoice in database before create order in paypal
    console.log("Create invoice:", products._id)
    const invoice = await Invoice.create({
      // invoice
      date_travel,
      number_of_guest,
      note,

      // amount
      amount_usd,
      amount_myr,
      rate: rate_myr,

      // status
      status: "pending",
      response_code: null,
      response_stringify: null,

      // Foreign key but not referenced
      customer_id: customer._id,
      merchant_id: merchant._id,
      product_id: products._id,
    })

    // if invoice not created throw error
    if (!invoice) {
      throw {
        message: `Failed to create invoice`,
        status: false,
      }
    }
    res
      .status(200)
      .json({ message: "success create order in database", invoice })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

/**
 * @path /payment/invoice/:id/pay
 * @method POST
 * @returns {Object} generated invoice, payment_url from paypal API
 * @description Create order in paypal
 * @scope Use Case 4
 */
payment.post("/invoice/:id/pay", customerAuth, async (req, res) => {
  try {
    console.log("Try to generate payment...")
    const { id } = req.params

    if (!id) {
      console.log("Invoice id is required")
      return res.status(500).json({ message: "Invoice id is required" })
    }

    const invoice = await Invoice.findOne({ _id: id })
    if (!invoice) {
      console.log("Invoice not found")
      return res.status(500).json({ message: "Invoice not found" })
    }

    const products = await Products.findOne({ _id: invoice.product_id })
    if (!products) {
      console.log("Product not found")
      return res.status(500).json({ message: "Product not found" })
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
        cancel_url: `${originFrom}/orders`,
      },
    }

    const { jsonResponse, httpStatusCode } = await createOrder(payment_body)

    const new_invoice = await Invoice.findOneAndUpdate(
      { _id: invoice._id },
      {
        status: "unpaid",
        response_code: jsonResponse.id,
        response_stringify: JSON.stringify(jsonResponse),
      }
    )

    res.status(httpStatusCode).json({
      message: "Success create order payment in PayPal",
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
    console.log("Trying to capture the payment...")

    const { id } = req.params

    if (!id) {
      return res.status(500).json({ message: "Invoice id is required" })
    }

    const invoice = await Invoice.findOne({ _id: id })

    if (!invoice) {
      return res.status(500).json({ message: "Invoice not found" })
    }

    const orderDetails = await getOrders(invoice.response_code)

    if (!orderDetails) {
      return res.status(500).json({ message: "Order not found" })
    }

    console.log("Order details:", orderDetails.jsonResponse)

    if (orderDetails.jsonResponse.status === "COMPLETED") {
      return res.redirect(`${process.env.FE_HOST}/orders`)
    }

    if (orderDetails.jsonResponse.status !== "APPROVED") {
      return res.status(500).json({ message: "Order not approved" })
    }

    const { jsonResponse, httpStatusCode } = await captureOrder(
      invoice.response_code
    )

    await Invoice.findOneAndUpdate(
      { _id: invoice._id },
      {
        status: "paid",
        response_code: jsonResponse.id,
        response_stringify: JSON.stringify(jsonResponse),
      }
    )

    // if user agent not from browser
    // res.status(httpStatusCode).json({ jsonResponse, invoice: updatedInvoice });

    // return to frontend
    return res.redirect(`${process.env.FE_HOST}/orders`)
  } catch (error) {
    console.error("Failed to capture order:", error.code ? error.code : error)
    return res.status(500).json({ error: "Failed to capture order." })
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
    if (jsonResponse.status === "APPROVED") {
      return res.status(200).json({
        message: "Order approved",
        status: "approved",
        details: "Your Payment link has been approved.",
      })
    }
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

/**
 * @path /payment/invoice/:id
 * @method DELETE
 * @returns {Object} message
 * @description Delete invoice
 */
payment.delete("/invoice/:id", customerAuth, async (req, res) => {
  try {
    const { id } = req.params
    console.log("Delete invoice:", id)
    if (!id) {
      return res.status(500).json({ message: "Invoice id is required" })
    }

    const decoded = req.user
    const invoice = await Invoice.findOne({ _id: id, customer_id: decoded.id })
    if (!invoice) {
      return res.status(500).json({ message: "Invoice not found" })
    }

    if (invoice.status === "paid") {
      return res.status(500).json({ message: "Invoice already paid" })
    }

    await invoice.deleteOne()
    return res.status(200).json({ message: "success delete invoice" })
  } catch (error) {}
})

module.exports = payment
