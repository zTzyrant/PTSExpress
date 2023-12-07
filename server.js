require("dotenv").config()
const express = require("express")
const app = express()
const port = process.env.PORT || 3000
const host = "0.0.0.0"
const mongoose = require("mongoose")
const cors = require("cors")
const {
  deleteUnregisteredImages,
  clearTempUploads,
} = require("./functions/deleteFiles")
const cron = require("node-cron")
const compression = require("compression")
const helmet = require("helmet")

console.log("process.env.NODE_ENV:", process.env.NODE_ENV)

mongoose.connect(process.env.DATABABE_URL)
const db = mongoose.connection

db.on("error", (error) => console.log(error))
db.once("open", () => console.log("Connected to database"))

app.use(
  cors({
    methods: "*",
  })
)
app.use(compression())
app.use(helmet())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const uploadsDir = require("path").join(__dirname, "uploads")
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin")
    next()
  },
  express.static(uploadsDir)
)

// Global middleware to set Cross-Origin-Resource-Policy header
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin")
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  )
  next()
})

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

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Welcome to the PTSExpress API",
    connection_db: db.name,
  })
})

app.listen(port, host, () => console.log(`Server running on port ${port}`))
