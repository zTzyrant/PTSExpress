const fs = require("fs-extra")
const path = require("path")
const Product_Pictures = require("../models/product_pictures")
const Merchant = require("../models/merchant")

// Delete all files in the uploads directory that are not registered in the database
const deleteUnregisteredImages = async () => {
  try {
    // Retrieve all registered filenames from the database
    const registeredFiles = await Product_Pictures.distinct("filename")
    const merchantFiles = await Merchant.distinct("document")

    const merchantFilenames = merchantFiles.map((file) => {
      return file.filename
    })

    // Get all filenames in the uploads directory
    const uploadDir = path.join(__dirname, "../uploads")
    const allFiles = await fs.readdir(uploadDir)

    // Identify unregistered files
    let filesCount = 0
    const unregisteredFiles = allFiles.filter((file) => {
      if (
        !registeredFiles.includes(file) &&
        !merchantFilenames.includes(file)
      ) {
        filesCount++
        return true
      }
    })

    console.log("All files:", allFiles.length)
    console.log("Product Pictures:", registeredFiles.length)
    console.log("Merchant Document:", merchantFilenames.length)
    console.log(`Found ${unregisteredFiles.length} unregistered files.`)

    if (filesCount === 0) {
      console.log("No unregistered files found.")
      return
    }

    console.log("Start deleting unregistered files...")
    // Delete unregistered files
    for (const file of unregisteredFiles) {
      const filePath = path.join(uploadDir, file)
      await fs.unlink(filePath)
      console.log(`Deleted unregistered file: ${file}`)
    }

    console.log("Cleanup completed successfully.")
  } catch (error) {
    console.error("Error during cleanup:", error)
  }
}

// Delete all files in the temp uploads directory
const clearTempUploads = async () => {
  try {
    const tempUploadsDir = path.join(__dirname, "../temp/uploads")
    const allFiles = await fs.readdir(tempUploadsDir)
    if (allFiles.length === 0) {
      console.log("No files found in temp uploads directory.")
      return
    }
    console.log("Start deleting temp uploads...")
    await fs.emptyDir(tempUploadsDir)
    console.log("Cleanup completed successfully.")
  } catch (error) {
    console.error("Error during cleanup:", error)
  }
}

module.exports = { deleteUnregisteredImages, clearTempUploads }
