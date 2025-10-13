const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

// Import database configuration
require('./config/database');

// Import routes
const contactRoutes = require('./routes/api'); 
const emailRoutes = require('./routes/emailRoute'); 
const chatRoutes = require('./routes/chatRoute')
// Import middleware
const middleware = require('./middleware');

const server = express();

// Apply middleware
middleware(server);

// Routes
server.use('/', contactRoutes);  
server.use('/', emailRoutes);
server.use('/', chatRoutes);

// Start the server
server.listen(8000, () => {
    console.log("Server is running on port 8000");
});