const express = require('express')
require('dotenv').config()
const multer = require('multer')
const image = multer({dest:'upload/'})
const multerS3 = require('multer-s3')
const aws = require('aws-sdk')
const path = require('path')
const client = require('./controller/redis')
const Bull = require('bull')



const app = express()
app.set("view engine", "ejs")
app.set('views', path.join(__dirname, './views'))

const s3 = new aws.S3()

aws.config.update({
    region:'ap-south-1',

    credentials:{accessKeyId:'AKIARODUXGRCPSKVN3G5',
    secretAccessKey: "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"}
})

const bucket_name = "inchhibucket"

const fileUploadQueue = new Bull('fileUploadQueue');

let upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: bucket_name,
        acl: "public-read",
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: function (req, file, cb) {
            cb(null, file.originalname);
        }
    })
});


app.get('/home',(req,res)=>{
    res.render('view')
})
app.post("/upload", upload.array("images", 100), (req, res, next)=>{
    const files = req.files.map(file => ({ originalname: file.originalname }));
    fileUploadQueue.add({ files });
    res.redirect('/home')
});

fileUploadQueue.process(async (job) => {
    const files = job.data.files;
    for (const file of files) {
        const s3Params = {
            Bucket: bucket_name,
            Key: file.originalname
        };

        const signedUrl = await s3.getSignedUrlPromise('getObject', s3Params);
        console.log('Signed URL for', file.originalname, ':', signedUrl);

        await client.set(file.originalname, signedUrl);
        await client.expire(file.originalname, 120); // Expire in 120 seconds
    }
});



app.get("/album", async (req, res, next) => {
    const baseURL = `https://${bucket_name}.s3.ap-south-1.amazonaws.com/`
    const cacheValue = await client.get('cachedData');
    if (cacheValue) {
      console.log('Data fetched from cache');
      const urlArr = JSON.parse(cacheValue).Contents.map(e => baseURL + e.Key);
      return res.render('render',{urlArr});
    }
s3.listObjects({Bucket: bucket_name})
.promise()
.then(data => {
    console.log(data)
    let urlArr = data.Contents.map(e => baseURL + e.Key);
    client.set('cachedData', JSON.stringify(data));
    client.expire('cachedData', 120);
    console.log('Data fetched from API and cached');
    res.render('render',{urlArr})
})
.catch(err => console.log(err));
})



app.listen(3000, () => {
    console.log(`Server is running on port 3000`);
})

