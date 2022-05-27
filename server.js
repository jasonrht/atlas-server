require('dotenv').config()

const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const algemeenLBModel = require('./algemeenLB')
const atlasUser = require('./atlasUser')
const atlasWerver = require('./atlasWerver')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { spawn } = require('child_process')
const backupModel = require('./backupModel')
const scraping = require('./scraping')
const dataModel = require('./dataModel')
const sendMail = require('./sendMail')
const multer = require('multer')
const path = require('path')
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/images')
    },
    filename: (req, file, cb) => {
        // console.log(file.originalname)
        const t = new Date()
        // cb(null, `${req.body.firstName}-${req.body.lastName}${t.getDate()}-${t.getMonth() + 1}-${t.getFullYear()}` + path.extname(file.originalname))
        cb(null, file.originalname)
    }
})
const upload = multer({ storage: storage })
const PORT = process.env.PORT || 3001;
const app = express();

app.use(cors())

app.use(express.json())

app.use(express.static('public'));

const uri = process.env.MONGO_URI
mongoose.connect(uri, { useNewUrlParser: true });
console.log('Connected to MongoDB client.')

async function main() {
    try {
        app.get('/refresh-data', (req, res) => {
            const python = spawn('python', ['./atlas-scraping.py'])
            let dataToSend;
            python.stdout.on('data', function (data) {
                console.log('listening for output ...')
                dataToSend = data.toString()
            })
            python.on('close', (code) => {
                res.send(dataToSend)
            })
        })

        let werverList = []

        app.get('/scrape-data', async (req, res) => {
            console.time('duration')
            const testWervers = ['Rosa de Kiefte']
            console.log('Fetching data ...')
            const scrape = await scraping.atlas()

            const date = new Date()
            const data = {
                date: date,
                data: scrape
            }
            const newData = new dataModel(data)
            await newData.save(async (err, newDataResult) => {
                console.log(data)
                console.log('data refreshed')
            })
            res.send(data)
            console.timeEnd('duration')
        })

        app.get('/data', async (req, res) => {
            let inputDate = -1
            dataModel.findOne({}, {}, { sort: { date: inputDate } }, (err, result) => {
                res.type('application/json')
                if (err) {
                    res.json(err)
                    console.log(err)
                } else {
                    res.json(result)
                }
            })
        })

        app.post('/new-pass', upload.single('file'), async (req, res) => {
            // req.file ? res.json(req.file) : console.log('File does not exist ...')
            const data = req.body
            const photoFile = req.file
            const emailData = {
                // receiver: 'Kelly',
                atlasLocation: req.body.vestiging,
                // address: 'Vivaldistraat',
                // city: 'Capelle',
                projects: req.body.project,
                firstName: req.body.naam.split(' ')[0],
                lastName: req.body.naam.split(' ').slice(1).join(' '),
                birthday: req.body.geboortedatum,
                photo: photoFile,
            }
            try {
                sendMail.sendMail(emailData)
                console.log('Email sent successfully !')
            } catch (err) {
                console.log(err)
            }
            return res.send(data)
        })

        let dates = {}
        app.post('/dates', (req, res) => {
            dates = req.body
            console.log(dates)
            console.log('dates posted!')
        })

        app.get('/getDates', (req, res) => {
            res.send(dates)
        })

        app.get('/users', async (req, res) => {
            atlasUser.find({}, (err, result) => {
                res.type('application/json')
                if (err) {
                    res.json(err)
                    console.log(err)
                } else {
                    res.json(result)
                }
            })
        })

        app.post('/add-user', async (req, res) => {
            try {
                const salt = await bcrypt.genSalt()
                const hashedPW = await bcrypt.hash(req.body.password, salt)
                console.log(hashedPW)

                const user = {
                    username: req.body.username,
                    email: req.body.email,
                    password: hashedPW,
                }
                const newUser = new atlasUser(user)

                await newUser.save(async (err, newUserResult) => {
                    console.log(user)
                    console.log('new user created')
                })
            } catch (e) {
                console.log(e)
            }
        })

        app.post('/delete-user', (req, res) => {
            console.log(req.body.name)
            atlasWerver.deleteOne({ name: req.body.naam }, (err) => {
                if (err) {
                    console.log(err)
                }
                console.log(`${req.body.name} deleted`)
            })
        })


        app.post('/users/login', async (req, res) => {
            const user = await atlasUser.findOne({ username: req.body.user })
            console.log(`userInfo: ${user}`)
            if (user == null) {
                return res.status(400).send('Cannot find user')
            }

            const generateAccessToken = (userObject) => {
                return jwt.sign(userObject.toJSON(), process.env.ACCESS_TOKEN, { expiresIn: '30m' })
            }

            let authenticated = false
            try {
                if (await bcrypt.compare(req.body.password, user.password)) {
                    authenticated = true
                    console.log('Login succes!')

                    // dont forget to add expiration date to token !!!
                    const accessToken = generateAccessToken(user)
                    const refreshToken = jwt.sign(user.toJSON(), process.env.REFRESH_TOKEN)
                    res.json({ authenticated: true, token: accessToken, refreshToken: refreshToken, user: user })
                } else {
                    res.json({ authenticated: false, message: 'no user exists' })
                    console.log('Login failed ...')
                }
            } catch (e) {
                console.log(e)
            }
        })

        app.get('/userAuth', authenticateToken, (req, res) => {
            res.send('user authenticated')
        })

        function authenticateToken(req, res, next) {
            const token = req.headers['authorization']
            console.log(`token: ${token}`)

            if (token === null) return res.sendStatus(401)

            jwt.verify(token, process.env.ACCESS_TOKEN, (err, user) => {
                if (err) {
                    console.log(err)
                    return res.sendStatus(403)
                }
                req.user = user
                next()
            })
        }

        app.get("/api", async (req, res) => {
            // let searchQuery = 'sort: {date: -1}'
            let inputDate = -1
            algemeenLBModel.findOne({}, {}, { sort: { date: inputDate } }, (err, result) => {
                res.type('application/json')
                if (err) {
                    res.json(err)
                    console.log(err)
                } else {
                    res.json(result)
                }
            })
        });

        app.get('/get-wervers', async (req, res) => {
            atlasWerver.find({}, (err, result) => {
                res.type('application/json')
                if (err) {
                    res.json(err)
                    console.log(err)
                } else {
                    res.json(result)
                    for (werver of result) {
                        werverList.push(werver.name)
                    }
                }
            })
        })

        app.post('/add-werver', async (req, res) => {
            try {
                const werver = {
                    name: req.body.name,
                    poule: req.body.poule,
                    status: req.body.status,
                }
                const newWerver = new atlasWerver(werver)

                await newWerver.save(async (err, newWerverResult) => {
                    console.log(werver)
                    console.log('new werver added')
                })
            } catch (e) {
                console.log(e)
            }
        })

        app.get('/backups', (req, res) => {
            backupModel.find({}, (err, result) => {
                res.type('application/json')
                if (err) {
                    res.json(err)
                    console.log(err)
                } else {
                    res.json(result)
                }
            })
        })

        app.listen(PORT, () => {
            console.log(`Server listening on ${PORT}`);
        });
    } catch (e) {
        console.error(e);
    }
};

// run script
main().catch(console.error); 
