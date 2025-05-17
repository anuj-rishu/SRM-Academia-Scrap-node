const { getProfile } = require('../utils/academiaApi');
const logger = require('../utils/logger');

exports.getProfile = async (req, res, next) => {
  try {
    const sessionCookies = req.headers['x-session-cookies'];
    if (!sessionCookies) {
      return res.status(400).json({
        status: false,
        message: 'Session cookies required in x-session-cookies header',
        errors: ['Missing session cookies']
      });
    }

    const profile = await getProfile(sessionCookies);
    
    return res.status(200).json({
      status: true,
      message: 'Profile fetched successfully',
      data: profile
    });
  } catch (err) {
    logger.error(`Profile fetch error: ${err.message}`);
    next(err); 
  }
};