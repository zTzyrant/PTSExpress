const authFunction = require("../functions/authFunction")
const Users = require("../models/users")

/**
 * @function ministryAuth
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 * @returns {Object} req.user (ministry) decoded from token
 * @description Authenticate ministry
 */
const ministryAuth = async (req, res, next) => {
  if (req.headers["authorization"]) {
    try {
      const token = req.headers["authorization"].split(" ")[1]
      const decoded = await authFunction.verifyToken(token)
      const user = await Users.findOne({ _id: decoded.id })
      if (user.is_ministry) {
        req.user = user
        next()
      } else {
        res.status(401).json({
          message: "Unauthorized not ministry",
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

module.exports = { ministryAuth }
