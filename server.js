require("dotenv").config()
const express = require("express")
const app = express()
const port = 3000
const host = "0.0.0.0"
const mongoose = require("mongoose")
const cors = require("cors")
const {
  deleteUnregisteredImages,
  clearTempUploads,
} = require("./functions/deleteFiles")
const cron = require("node-cron")

mongoose.connect(process.env.DATABABE_URL)
const db = mongoose.connection

db.on("error", (error) => console.log(error))
db.once("open", () => console.log("Connected to database"))

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const uploadsDir = require("path").join(__dirname, "uploads")
app.use("/uploads", express.static(uploadsDir))

// Run cron job every Sunday at 00:00 for deleting unregistered images or files
cron.schedule("0 0 * * 0", async () => {
  console.log(
    `Running cron job at ${new Date().toLocaleString("id-ID", {
      timeZone: "Asia/Makassar",
    })}`
  )
  await deleteUnregisteredImages()
  await clearTempUploads()
})

const route = require("./routes/route")
const auth = require("./routes/auth")
const ministry = require("./routes/ministry")
const merchant = require("./routes/merchant")
const payment = require("./routes/payment")
const customer = require("./routes/customer")

app.use("/api", route)
app.use("/auth", auth)
app.use("/ministry", ministry)
app.use("/merchant", merchant)
app.use("/payment", payment)
app.use("/customer", customer)

app.post("/test-ft", (req, res) => {
  console.log(req.body)
  res.status(200).json({ message: "success" })
})

app.listen(port, host, () => console.log(`Server running on port ${port}`))
