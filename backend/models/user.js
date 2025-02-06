const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true,unique: false },
    email: { type: String, required: true, unique: false },
    message: { type: String, required: true}
   
    
});

const User = mongoose.model('contact-details', userSchema, 'contact-details');

module.exports = User
