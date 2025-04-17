const express = require("express");
const { tokenMiddleware } = require("../middleware/authMiddleware");
const { cacheMiddleware } = require("../middleware/cacheMiddleware");
const { getUpcomingClasses } = require("../handlers/upcomingClassesHandler");
const {
  getTodayClasses,
  getTomorrowClasses,
  getDayAfterTomorrowClasses,
} = require("../handlers/todayClassesHandler");
const { handleError } = require("../utils/errorHandler");

const router = express.Router();

function routeHandler(fn) {
  return async (req, res) => {
    try {
      const data = await fn(req.headers["x-csrf-token"]);
      res.json(data);
    } catch (error) {
      handleError(res, error);
    }
  };
}

router.get("/upcoming-classes", tokenMiddleware, cacheMiddleware, routeHandler(getUpcomingClasses));
router.get("/today-classes", tokenMiddleware, cacheMiddleware, routeHandler(getTodayClasses));
router.get("/tomorrow-classes", tokenMiddleware, cacheMiddleware, routeHandler(getTomorrowClasses));
router.get("/day-after-tomorrow-classes", tokenMiddleware, cacheMiddleware, routeHandler(getDayAfterTomorrowClasses));

module.exports = router;