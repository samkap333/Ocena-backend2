const mongoose = require('mongoose')

const emailSchema = new mongoose.Schema({
    email: {type:String, required: true,unique:true},
    createdAt: { type: Date, default: Date.now }

});

const Email = mongoose.model('email-details', emailSchema,'email-details');

module.exports = Email;