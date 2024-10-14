const cors = require('cors');
const bodyParser = require('body-parser');

const applyMiddleware = (server) => {
    server.use(cors());
    server.use(bodyParser.json());
};

module.exports = applyMiddleware;