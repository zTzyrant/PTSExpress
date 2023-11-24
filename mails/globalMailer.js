require("dotenv").config()
const nodemailer = require("nodemailer")

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_EMAIL,
    pass: process.env.MAIL_PASSWORD,
  },
})

const emailUserCreated = async (userData, res, originalPassword) => {
  const mailOptions = {
    from: process.env.MAIL_EMAIL,
    to: userData.email,
    subject: "Your account has been created",
    html: `Your account has been created, you can login with the account information below.<br/><br/>Username: ${userData.username}<br/>Email: ${userData.email}<br/>Password: ${originalPassword}<br/><br/>Thank you!`,
  }
  try {
    await transporter.sendMail(mailOptions)
    console.log("email sent")
    res.status(200).json({
      message: `User Created & email has been send to ${userData.email}`,
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

module.exports = { emailUserCreated }
