const mongoose = require('mongoose')

const backupSchema = new mongoose.Schema({
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

const backupModel = mongoose.model("backupModel", backupSchema)
module.exports = backupModel