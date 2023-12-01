const formidable = require("formidable")
const mv = require("mv")
const path = require("path")
const fs = require("fs-extra")

// handle form data from request
const handleFormData = async (req) => {
  // remove all files in temp/uploads
  await fs.emptyDir(path.join(__dirname, "../temp/uploads"))
  const form_data = new formidable.IncomingForm({
    multiples: true,
    uploadDir: path.join(__dirname, "../temp/uploads"),
    keepExtensions: true,
  })
  const [fields, files] = await new Promise((resolve, reject) => {
    form_data.parse(req, (err, fields, files) => {
      if (err) reject(err)
      resolve([fields, files])
    })
  })
  return { fields, files }
}

// upload picture to uploads folder
const uploadPicture = async (files) => {
  const pictures = []
  try {
    files.pictures.forEach((picture) => {
      const filename = `${Date.now()}-${picture.originalFilename}`
      const oldpath = picture.filepath
      const newpath = path.join(__dirname, "../uploads", filename)
      mv(oldpath, newpath, (err) => {
        if (err) throw err
      })
      pictures.push({
        filename: filename,
        url: `/uploads/${filename}`,
        size: picture.size,
      })
    })
    return pictures
  } catch (error) {
    console.log("Error upload picture: ", error)
    return null
  }
}

module.exports = { handleFormData, uploadPicture }
