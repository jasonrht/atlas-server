const axios = require('axios')

axios.get('http://localhost:3001/data').then((err, res) => {
    if(err) {
        console.log(err)
    }
    console.log(res)
})