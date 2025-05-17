const { getSession, lookupUser, logoutAcademia } = require('../utils/academiaApi');
const logger = require('../utils/logger');

async function loginHandler(req, res, next) {
  try {
    const { user, pass } = req.body;
    if (!user || !pass) {
      return res.status(400).json({
        status: false,
        message: 'User and password required',
        errors: ['Missing credentials']
      });
    }
    
    const userEmail = user.includes('@srmist.edu.in') ? user : `${user}@srmist.edu.in`;
    
    const lookupInfo = await lookupUser(userEmail);

    if (lookupInfo.errors && lookupInfo.errors.length > 0) {
      return res.status(401).json({
        status: false,
        message: lookupInfo.message || 'Lookup failed',
        errors: lookupInfo.errors.map(e => e.message)
      });
    }

    if (!lookupInfo.lookup) {
      return res.status(404).json({
        status: false,
        message: 'User not found',
        errors: null
      });
    }

    const sessionInfo = await getSession(pass, lookupInfo.lookup);

    if (
      sessionInfo.message?.toLowerCase().includes("invalid") ||
      sessionInfo.sessionCookies?.includes("undefined")
    ) {
      return res.status(401).json({
        status: false,
        message: sessionInfo.message || "Invalid credentials",
        errors: null
      });
    }

    return res.status(200).json({
      status: true,
      message: 'Login successful',
      data: {
        sessionCookies: sessionInfo.sessionCookies,
        user: userEmail
      }
    });
  } catch (err) {
    logger.error(`Login error: ${err.message}`);
    next(err);
  }
}

async function logoutHandler(req, res, next) {
  try {
    const { sessionToken } = req.body;
    if (!sessionToken) {
      return res.status(400).json({
        status: false,
        message: 'Session token required',
        errors: ['Token missing']
      });
    }
    
    await logoutAcademia(sessionToken);
    
    return res.status(200).json({
      status: true,
      message: 'Logout successful'
    });
  } catch (err) {
    logger.error(`Logout error: ${err.message}`);
    next(err);
  }
}

module.exports = { loginHandler, logoutHandler };