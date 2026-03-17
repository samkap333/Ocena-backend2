const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

// Import routes
const contactRoutes = require('./routes/api');
const emailRoutes   = require('./routes/emailRoute');
const chatRoutes    = require('./routes/chatRoute');
const careerRoutes  = require('./routes/careerRoute');

// Import middleware
const middleware = require('./middleware');

const server = express();

// Apply middleware
middleware(server);

// Routes
server.use('/', contactRoutes);
server.use('/', emailRoutes);
server.use('/', chatRoutes);
server.use('/', careerRoutes);

// Start the server
server.listen(8000, () => {
  console.log('Server is running on port 8000');
});