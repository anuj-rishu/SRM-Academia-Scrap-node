const express = require("express");
const router = express.Router();

const attendanceController = require("../controllers/attendanceController");
const marksController = require("../controllers/marksController");

router.post("/attendance", attendanceController.getAttendance);
router.post("/marks", marksController.getMarks);

module.exports = router;