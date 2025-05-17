const express = require('express');
const { loginHandler, logoutHandler } = require('../controllers/authController');

const router = express.Router();

router.post('/login', loginHandler);
router.post('/logout', logoutHandler);

module.exports = router;