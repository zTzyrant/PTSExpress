require("dotenv").config()
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const generator = require("generate-password")

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

const generatePassword = () => {
  const password = generator.generate({
    length: 8,
    uppercase: true,
    lowercase: true,
    numbers: true,
  })
  return password
}

const creteToken = async (user) => {
  console.log(user)
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
