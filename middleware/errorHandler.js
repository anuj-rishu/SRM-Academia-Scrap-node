const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error(`${err.message}`, { 
    url: req.originalUrl,
    method: req.method,
    stack: err.stack
  });
  
  res.status(500).json({
    status: false,
    message: 'Internal server error',
    errors: [err.message]
  });
}

module.exports = errorHandler;