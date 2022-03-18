const axios = require('axios')

const main = async () => {
    const response = await axios.get('http://localhost:3001/getDates')
    const date = new Date()
    console.log(response)
}

main()