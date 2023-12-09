require("dotenv").config()
const { transporter } = require("./transporter")

/**
 * @function merchantApproved
 * @param {Object} merchantData
 * @param {Object} res
 * @description Send email to merchant when merchant approved with the merchant login information
 * @returns {Object} res status 200 if success, status 500 if error
 */
const merchantApproved = async (merchantData, res) => {
  const mailOptions = {
    from: process.env.MAIL_EMAIL,
    to: merchantData.email,
    subject: "Your Merchant has been approved",
    html: `Your Merchant ${merchantData.company_name} has been approved, you can login with the account information below.<br/><br/>Username: ${merchantData.username}<br/>Email: ${merchantData.email}<br/>Password: ${merchantData.password}<br/><br/>Thank you!`,
  }
  try {
    const info = await transporter.sendMail(mailOptions)
    console.log("email sent", info.response)
    res.status(200).json({
      message: `Merchant Approved & email has been send to ${merchantData.email}`,
    })
  } catch (error) {
    if (error.code === "ECONNREFUSED") {
      console.log("The connection to the mail server was refused.")
    } else if (error.code === "ETIMEOUT") {
      console.log("The connection to the mail server timed out.")
    } else {
      console.log("Unknown error occurred while sending email:", error)
    }
    res.status(500).json({
      message: `Error while sending email, error caused: ${
        error.message ? error.message : error
      }`,
    })
  }
}

/**
 * @function merchantResetPassword
 * @param {Object} merchantData
 * @param {Object} res
 * @description Send email to merchant when merchant reset password with the merchant login information
 */
const merchantResetPassword = async (merchantData, res) => {
  const mailOptions = {
    from: process.env.MAIL_EMAIL,
    to: merchantData.email,
    subject: "Your Merchant password has been reset",
    html: `Your Merchant ${merchantData.company_name} password has been reset, you can login with the account information below.<br/><br/>Username: ${merchantData.username}<br/>Email: ${merchantData.email}<br/>Password: ${merchantData.password}<br/><br/>Thank you!`,
  }
  try {
    const info = await transporter.sendMail(mailOptions)
    console.log("email sent:", info.response)
    res.status(200).json({
      message: `Merchant Approved & email has been send to ${merchantData.email}`,
    })
  } catch (error) {
    if (error.code === "ECONNREFUSED") {
      console.log("The connection to the mail server was refused.")
    } else if (error.code === "ETIMEOUT") {
      console.log("The connection to the mail server timed out.")
    } else {
      console.log("Unknown error occurred while sending email:", error)
    }
    res.status(500).json({
      message: `Error while sending email, error caused: ${
        error.message ? error.message : error
      }`,
    })
  }
}

module.exports = { merchantApproved, merchantResetPassword }
