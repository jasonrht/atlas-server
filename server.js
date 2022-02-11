require('dotenv').config()

const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const algemeenLBModel = require('./algemeenLB')
const atlasUser = require('./atlasUser')
const atlasWerver = require('./atlasWerver')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const {spawn} = require('child_process')
const backupModel = require('./backupModel')

const PORT = process.env.PORT || 3001;
const app = express();

app.use(cors())
app.use(express.json())

const uri = process.env.MONGO_URI
mongoose.connect(uri, { useNewUrlParser: true});
console.log('Connected to MongoDB client.')

async function main() {
    try {
        app.get('/refresh-data', (req, res) => {
            const python = spawn('python3', ['./atlas-scraping.py'])
            let dataToSend;
            python.stdout.on('data', function (data) {
                console.log('listening for output ...')
                dataToSend = data.toString()
            })
            python.on('close', (code) => {
                res.send(dataToSend)
            })
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
                if(err) {
                    res.json(err)
                    console.log(err)
                } else {
                    res.json(result)
                }
            })
        })

        app.post('/add-user', async (req, res) => {
            try{
                const salt = await bcrypt.genSalt()
                const hashedPW = await bcrypt.hash(req.body.password, salt)
                console.log(hashedPW)
                
                const user = {
                    username: req.body.username, 
                    email: req.body.email, 
                    password: hashedPW,
                }
                const newUser = new atlasUser(user)

                await newUser.save( async(err, newUserResult) => {
                    console.log(user)
                    console.log('new user created')
                })
            } catch(e) {
                console.log(e)
            }        
        })

        app.post('/users/login', async (req, res) => {
            const user = await atlasUser.findOne({username: req.body.user})
            console.log(`user: ${user}`)
            if(user == null){
                return res.status(400).send('Cannot find user')
            }

            let authenticated = false
            try{
                if(await bcrypt.compare(req.body.password, user.password)){
                    authenticated = true
                    console.log('Login succes!')

                    // dont forget to add expiration date to token !!!
                    const accessToken = jwt.sign(user.toJSON(), process.env.ACCESS_TOKEN)
                    res.json({authenticated: true, token: accessToken, user: user})
                } else {
                    res.json({authenticated: false, message:'no user exists'})
                    console.log('Login failed ...')
                }
            } catch(e){
                console.log(e)
            }
        })

        app.get('/userAuth', authenticateToken, (req,res) => {
            res.send('user authenticated')
        })

        function authenticateToken(req, res, next) {
            const token = req.headers['authorization']
            console.log(`token: ${token}`)

            if(token === null) return res.sendStatus(401)

            jwt.verify(token, process.env.ACCESS_TOKEN, (err,user) => {
                if(err) {
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
            algemeenLBModel.findOne({}, {}, {sort: {date: inputDate}}, (err, result) => {
                res.type('application/json')
                if (err) {
                    res.json(err)
                    console.log(err)
                } else {
                    res.json(result)
                }
            })
        });

        app.post('/add-werver', async (req,res) => {
            try {
                const werver = {
                    name: req.body.name, 
                    poule: req.body.poule,
                    status: req.body.status,
                }
                const newWerver = new atlasWerver(werver)
    
                await newWerver.save(async(err, newWerverResult) => {
                    console.log(werver)
                    console.log('new werver added')
                })
            } catch(e) {
                console.log(e)
            }
        })

        app.get('/backups', (req, res) => {
            backupModel.find({}, (err, result) => {
                res.type('application/json')
                if(err) {
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
