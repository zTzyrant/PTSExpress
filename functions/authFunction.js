require("dotenv").config()
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const generator = require("generate-password")

/**
 * @param {string} password
 * @returns {string} hash
 * @description hash paassword with bcrypt using salt and secret
 */
const hashPassword = async (password) => {
  try {
    const passwordSalted = password + process.env.SALT_SECRET
    const hash = await bcrypt.hash(passwordSalted, 12)
    return hash
  } catch (err) {
    console.log(err)
    return null
  }
}

/**
 * @param {string} password
 * @param {string} hash
 * @returns {boolean} match
 * @description compare password with hashed password
 */
const comparePassword = async (password, hash) => {
  try {
    const passwordSalted = password + process.env.SALT_SECRET
    const match = await bcrypt.compare(passwordSalted, hash)
    return match
  } catch (err) {
    console.log(err)
    return null
  }
}

/**
 * @returns {string} password
 * @description generate random password
 */
const generatePassword = () => {
  const password = generator.generate({
    length: 8,
    uppercase: true,
    lowercase: true,
    numbers: true,
  })
  return password
}

/**
 * @param {object} user
 * @returns {string} token
 * @description create token with jwt and expire in 7 days
 */
const creteToken = async (user) => {
  console.log("Create token:", user.fullname)
  const token = jwt.sign(
    {
      id: user._id,
      username: user.username,
      email: user.email,
      fullname: user.fullname,
      date_of_birth: user.date_of_birth,
      phone_number: user.phone_number,
      is_ministry: user.is_ministry,
      is_merchant: user.is_merchant,
      is_customer: user.is_customer,
      is_first_login: user.is_first_login,
      merchant_id: user.merchant_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  )
  return token
}

const verifyToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    return decoded
  } catch (err) {
    console.log(err)
    return null
  }
}

module.exports = {
  hashPassword,
  comparePassword,
  generatePassword,
  creteToken,
  verifyToken,
}
