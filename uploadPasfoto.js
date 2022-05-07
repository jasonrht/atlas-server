const crypto = require('crypto')
const methodOverride = require('method-override')
const multer = require('multer')
const GridFsStorage = require('multer-gridfs-storage')
const path = require('path')
const mongoose = require('mongoose')

const url = process.env.MONGO_URI

const connect = mongoose.createConnection(url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})

let gfs

connect.once('open', () => {
    gfs = new mongoose.mongo.GridFSBucket(connect.db, {
        bucketName: 'uploads',
    })
})

///////

const storage = new GridFsStorage({
    url: url,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err)
                }
                const filename = buf.toString('hex') + path.extname(file.originalname)
                const fileInfo = {
                    filename: filename,
                    bucketName: 'uploads',
                }
                resolve(fileInfo)
            })
        })
    }
})

const upload = multer({ storage })