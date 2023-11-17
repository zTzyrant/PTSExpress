const formidable = require("formidable")
const mv = require("mv")
const path = require("path")

const handleFormData = async (req) => {
  const form_data = new formidable.IncomingForm()
  const [fields, files] = await new Promise((resolve, reject) => {
    form_data.parse(req, (err, fields, files) => {
      if (err) reject(err)
      resolve([fields, files])
    })
  })
  return { fields, files }
}

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
    console.log(error)
    return null
  }
}

module.exports = { handleFormData, uploadPicture }
