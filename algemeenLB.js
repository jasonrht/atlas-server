const mongoose = require('mongoose')

const algemeenSchema = new mongoose.Schema({
	id: {
		type: String,
		required: true
	},
	index: {
		type: Array,
		required: true
	},
    columns: {
        type: Array,
        required: true
    },
    data: {
        type: Array,
        required: true,
    },
})

const algemeenModel = mongoose.model("algemeenModel", algemeenSchema)
module.exports = algemeenModel