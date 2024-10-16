const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

// Import database configuration
require('./config/database');

// Import routes
const contactRoutes = require('./routes/api'); // for contact-us details route
const emailRoutes = require('./routes/emailRoute'); // for newsletter route

// Import middleware
const middleware = require('./middleware');

const server = express();

// Apply middleware
middleware(server);

// Routes
server.use('/', contactRoutes);  //using contactRoute here
server.use('/', emailRoutes);   //using emailRoute 

// Start the server
server.listen(8000, () => {
    console.log("Server is running on port 8000");
});