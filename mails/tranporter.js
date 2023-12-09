require("dotenv").config()
const nodemailer = require("nodemailer")

/**
 * @constant authOptions
 * @description Auth options for nodemailer
 * @returns {Object} authOptions
 */
const authOptions = {
  auth: {
    user: process.env.MAIL_EMAIL,
    pass: process.env.MAIL_PASSWORD,
  },
}

/**
 * @function transporter
 * @description Create transporter for sending email
 */
const transporter = nodemailer.createTransport(
  process.env.NODE_ENV === "production"
    ? {
        name: process.env.MAIL_HOST,
        host: process.env.MAIL_HOST,
        port: 465,
        secure: true,
        ...authOptions,
      }
    : {
        service: "gmail",
        ...authOptions,
      }
)

module.exports = { transporter }
