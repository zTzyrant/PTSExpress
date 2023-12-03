require("dotenv").config()
/**
 * @param {*} origin
 * @returns string {BE_HOST or BE_TUNNEL}
 * @description check if request is from tunnel or not and return the correct host
 * @description if production, return BE_HOST only
 */
const isFromTunnel = (origin) => {
  console.log("Request from: ", origin)
  console.log("production: ", process.env.NODE_ENV === "production")
  if (process.env.NODE_ENV === "production") {
    return process.env.BE_HOST
  }
  if (origin === process.env.FE_TUNNEL) {
    return process.env.BE_TUNNEL
  } else {
    return process.env.BE_HOST
  }
}

module.exports = { isFromTunnel }
