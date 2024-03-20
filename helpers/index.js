const sharp = require('sharp')
const convertImageToWebp = async (data) => {
    return new Promise((resolve, reject) => {
      sharp(data.buffer).webp({ quality: 50 })
        .toBuffer()
        .then(async (newBuffer) => {
          let upload_ = await uploadImageToS3(data, newBuffer)
          resolve(upload_);;
        })
        .catch((err) => {
  
          resolve(false)
        });
    })
  }