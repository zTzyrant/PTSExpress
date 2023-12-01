const authFunction = require("../functions/authFunction")
const Users = require("../models/users")

const merchantAuth = async (req, res, next) => {
  if (req.headers["authorization"]) {
    try {
      const token = req.headers["authorization"].split(" ")[1]
      const decoded = await authFunction.verifyToken(token)
      const user = await Users.findOne({ _id: decoded.id })
      if (user.is_merchant) {
        req.user = user
        next()
      } else {
        res.status(401).json({
          message: "Unauthorized not merchant",
        })
      }
    } catch (error) {
      res.status(401).json({
        message: "Unauthorized token invalid",
      })
    }
  } else {
    res.status(401).json({
      message: "Unauthorized token not found",
    })
  }
}

module.exports = { merchantAuth }
