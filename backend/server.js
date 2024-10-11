const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

// Import database configuration
require('./config/database');

// Import routes
const emailRoutes = require('./routes/api');

// Import middleware
const middleware = require('./middleware');

const server = express();

// Apply middleware
middleware(server);

// Routes
server.use('/', emailRoutes);

// Start the server
server.listen(8000, () => {
    console.log("Server is running on port 8000");
});