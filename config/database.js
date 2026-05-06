const mongoose = require('mongoose');

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ocena_crm';

mongoose.connect(mongoUri)
    .then(() => {
        console.log("Connected to MongoDB");
    })
    .catch(err => {
        console.error("Error connecting to MongoDB:", err);
    });

module.exports = mongoose;
