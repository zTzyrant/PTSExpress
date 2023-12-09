require("dotenv").config()
const mongoose = require("mongoose")
mongoose.connect(process.env.DATABABE_URL)
const db = mongoose.connection

db.on("error", (error) => console.log(error))
db.once("open", () => console.log("Connected to database"))
