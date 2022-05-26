const mongoose = require('mongoose')

const werverSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true
	},
	status: {
		type: String,
		required: true
	},
	poule: {
		type: String
	},
})

const werverModel = mongoose.model("atlasWervers", werverSchema)
module.exports = werverModel