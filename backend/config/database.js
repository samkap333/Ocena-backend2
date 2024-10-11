const mongoose = require('mongoose');

// Log the Mongo URI to ensure it's being loaded correctly
console.log('Mongo URI:', process.env.MONGO_URI);

// Connect to MongoDB using the URI from the .env file
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("Connected to MongoDB Atlas");
    })
    .catch(err => {
        console.error("Error connecting to MongoDB Atlas:", err);
    });

module.exports = mongoose;