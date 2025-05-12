const express = require('express');
const { tokenMiddleware } = require('../middleware/authMiddleware');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');
const { getCourses } = require('../handlers/courseHandler');
const { getCalendar } = require('../handlers/calendarHandler');
const { getTodayDayOrder } = require('../handlers/dayOrderHandler');
const { getMarks } = require('../handlers/marksHandler');
const { getAttendance } = require('../handlers/attendanceHandler');
const { getTimetable } = require('../handlers/timetableHandler');
const { getFeedbackForm } = require('../handlers/feedbackHandler');
const { handleError } = require('../utils/errorHandler');

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

router.get("/courses", tokenMiddleware, cacheMiddleware, routeHandler(getCourses));
router.get("/calendar", tokenMiddleware, cacheMiddleware, routeHandler(getCalendar));
router.get("/dayorder", tokenMiddleware, cacheMiddleware, routeHandler(getTodayDayOrder));
router.get("/marks", tokenMiddleware, cacheMiddleware, routeHandler(getMarks));
router.get("/attendance", tokenMiddleware, cacheMiddleware, routeHandler(getAttendance));
router.get("/timetable", tokenMiddleware, cacheMiddleware, routeHandler(getTimetable));
router.get("/feedback", tokenMiddleware, cacheMiddleware, routeHandler(getFeedbackForm));

module.exports = router;