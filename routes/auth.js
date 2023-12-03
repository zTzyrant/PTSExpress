require("dotenv").config()
const express = require("express")
const auth = express.Router()
const Users = require("../models/users")
const jwt = require("jsonwebtoken")
const authFunction = require("../functions/authFunction")
const moment = require("moment")
const globalMailer = require("../mails/globalMailer")

auth.get("/", (req, res) => {
  res.send("Hello world from auth")
})

auth.post("/login", async (req, res) => {
  // Validate user input
  const { username, email, password, isEmailLogin } = req.body
  if (!password || (isEmailLogin && !email) || (!isEmailLogin && !username)) {
    res.status(400).json({ message: "Invalid input" })
  } else {
    try {
      const user = isEmailLogin
        ? await Users.findOne({
            email: email,
          })
        : await Users.findOne({
            username: username,
          })

      if (user) {
        const isPasswordMatch = await authFunction.comparePassword(
          password,
          user.password
        )
        // Create token
        if (!isPasswordMatch) {
          throw { message: "Wrong password", status: 401 }
        }

        const token = await authFunction.creteToken(user)
        // Send token with expiration time (7 days)
        res.status(200).json({
          token: token,
          expiresIn: Date.now() + 604800000,
          date_expired: moment().add(7, "days").format("YYYY-MM-DD"),
        })
      } else {
        res.status(404).json({ message: "User not found" })
      }
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  }
})

auth.get("/user/profile", async (req, res) => {
  const token = req.headers["authorization"]
    ? req.headers["authorization"].split(" ")[1]
    : null
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = await Users.findOne({ _id: decoded.id })
      res.status(200).json(user)
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  } else {
    res.status(401).json({ message: "Unauthorized" })
  }
})

auth.post("/ministry", async (req, res) => {
  // Validate user input
  const { username, email, password, fullname, phone_number, date_of_birth } =
    req.body
  if (
    !username ||
    !email ||
    !password ||
    !fullname ||
    !phone_number ||
    !date_of_birth
  ) {
    res.status(400).json({ message: "Invalid input" })
  } else {
    try {
      // Check if user already exists
      const checkUsername = await Users.findOne({ username: username })
      const checkEmail = await Users.findOne({ email: email })

      if (checkUsername || checkEmail) {
        res.status(409).json({ message: "User already exists" })
      } else {
        // Create new user
        const newUser = new Users({
          username: username,
          email: email,
          password: password,
          fullname: fullname,
          phone_number: phone_number,
          date_of_birth: date_of_birth,
          is_ministry: true,
          is_merchant: false,
          is_customer: false,
        })
        // Save new user
        const savedUser = await newUser.save()
        res.status(201).json(savedUser)
      }
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  }
})

auth.get("/check-username/:username", async (req, res) => {
  const username = req.params.username
  if (!username) {
    res.status(400).json({ message: "Invalid input" })
  } else {
    const checkUsername = await Users.findOne({ username: username })
    if (checkUsername) {
      res.status(409).json({ message: "Username already exists" })
    } else {
      res.status(200).json({ message: "Username available" })
    }
  }
})

auth.get("/check-email/:email", async (req, res) => {
  const email = req.params.email
  const isEmaiValid = /\S+@\S+\.\S+/.test(email)
  if (!isEmaiValid) {
    res.status(400).json({ message: "Invalid email" })
  } else {
    if (!email) {
      res.status(400).json({ message: "Invalid input" })
    } else {
      const checkEmail = await Users.findOne({ email: email })
      if (checkEmail) {
        res.status(409).json({ message: "Email already exists" })
      } else {
        res.status(200).json({ message: "Email available" })
      }
    }
  }
})

auth.get("/is-ministry", async (req, res) => {
  const token = req.headers["authorization"]
    ? req.headers["authorization"].split(" ")[1]
    : null
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = await Users.findOne({ _id: decoded.id })
      if (user.is_ministry) {
        res.status(200).json({ is_ministry: user.is_ministry })
      } else {
        throw { message: "User is not ministry", status: 403 }
      }
    } catch (err) {
      if (err.status === 403) {
        res.status(err.status).json({ message: err.message })
      } else {
        res.status(500).json({ message: err.message })
      }
    }
  } else {
    res.status(401).json({ message: "Unauthorized" })
  }
})

auth.get("/is-merchant", async (req, res) => {
  const token = req.headers["authorization"]
    ? req.headers["authorization"].split(" ")[1]
    : null
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = await Users.findOne({ _id: decoded.id })
      if (user.is_merchant) {
        res.status(200).json({ is_merchant: user.is_merchant })
      } else {
        throw { message: "User is not merchant", status: 403 }
      }
    } catch (err) {
      if (err.status === 403) {
        res.status(err.status).json({ message: err.message })
      } else {
        res.status(500).json({ message: err.message })
      }
    }
  } else {
    res.status(401).json({ message: "Unauthorized" })
  }
})

auth.get("/is-customer", async (req, res) => {
  const token = req.headers["authorization"]
    ? req.headers["authorization"].split(" ")[1]
    : null
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = await Users.findOne({ _id: decoded.id })
      if (user.is_customer) {
        res.status(200).json({
          is_customer: user.is_customer,
          message: "User is customer",
        })
      } else {
        res.status(200).json({
          is_customer: user.is_customer,
          message: "User is not customer",
        })
      }
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  } else {
    res.status(401).json({ message: "Unauthorized" })
  }
})

auth.get("/is-first-login", async (req, res) => {
  const token = req.headers["authorization"]
    ? req.headers["authorization"].split(" ")[1]
    : null
  if (token) {
    try {
      const decoded = await authFunction.verifyToken(token)
      const user = await Users.findOne({ _id: decoded.id })
      if (user.is_first_login) {
        res.status(200).json({
          message: "User is first time login.",
          isfirstlogin: true,
        })
      } else {
        res.status(200).json({
          message: "User is not first time login.",
          isfirstlogin: false,
        })
      }
    } catch (err) {
      if (err.status === 403) {
        res.status(err.status).json({ message: err.message })
      } else {
        res.status(500).json({ message: err.message })
      }
    }
  } else {
    res.status(401).json({ message: "Unauthorized" })
  }
})

auth.put("/reset-password", async (req, res) => {
  const token = req.headers["authorization"]
    ? req.headers["authorization"].split(" ")[1]
    : null
  if (token) {
    try {
      const decoded = await authFunction.verifyToken(token)
      const user = await Users.findOne({ _id: decoded.id })
      if (user.is_first_login) {
        const { password } = req.body
        if (!password) {
          res.status(400).json({ message: "Invalid input" })
        } else {
          const passwordHashed = await authFunction.hashPassword(password)
          const updatedUser = await Users.updateOne(
            { _id: decoded.id },
            { password: passwordHashed, is_first_login: false }
          )
          res.status(200).json({
            message: "Password updated",
            user: {
              username: updatedUser.username,
              email: updatedUser.email,
              fullname: updatedUser.fullname,
              date_of_birth: updatedUser.date_of_birth,
              phone_number: updatedUser.phone_number,
              is_ministry: updatedUser.is_ministry,
              is_merchant: updatedUser.is_merchant,
              is_customer: updatedUser.is_customer,
            },
          })
        }
      } else {
        throw { message: "User is not first time login", status: 403 }
      }
    } catch (err) {
      if (err.status === 403) {
        res.status(err.status).json({ message: err.message })
      } else {
        res.status(500).json({ message: err.message })
      }
    }
  } else {
    res.status(401).json({ message: "Unauthorized" })
  }
})

auth.post("/customer", async (req, res) => {
  try {
    // Validate user input
    const { username, email, password, fullname, phone_number, date_of_birth } =
      req.body
    if (
      !username ||
      !email ||
      !password ||
      !fullname ||
      !phone_number ||
      !date_of_birth
    ) {
      return res.status(400).json({ message: "Invalid input" })
    }

    if (!username.match(/^[a-zA-Z0-9]+$/)) {
      return res.status(400).json({ message: "Invalid username" })
    }

    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ message: "Invalid email" })
    }

    if (!phone_number.match(/^[0-9]+$/)) {
      return res.status(400).json({ message: "Invalid phone number" })
    }

    // Check if user already exists
    const checkUsername = await Users.findOne({ username: username })
    const checkEmail = await Users.findOne({ email: email })

    if (checkUsername || checkEmail) {
      return res.status(409).json({ message: "User already exists" })
    }
    // password before hash
    const originalPassword = password
    // hash password
    const hashedPassword = await authFunction.hashPassword(password)

    // Create new user
    const newUser = new Users({
      username: username,
      email: email,
      password: hashedPassword,
      fullname: fullname,
      phone_number: phone_number,
      date_of_birth: date_of_birth,
      is_ministry: false,
      is_merchant: false,
      is_customer: true,
    })
    // Save new user
    const savedUser = await newUser.save()
    await globalMailer.emailUserCreated(savedUser, res, originalPassword)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = auth
