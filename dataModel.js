const mongoose = require('mongoose')

const dataSchema = new mongoose.Schema({
	date: {
		type: Date,
		required: true,
	},
	data: {
		type: Array,
		required: true
	},
})

const dataModel = mongoose.model("dataModel", dataSchema)
module.exports = dataModel