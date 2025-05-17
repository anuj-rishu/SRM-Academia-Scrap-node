const { getAttendanceOnly } = require("../utils/academiaApi");
const logger = require("../utils/logger");

function formatAttendanceResponse(data) {
  const regNumber = data.studentInfo.registrationNumber || null;
  const attendance = (data.attendance || []).map((course) => ({
    courseCode: course.courseCode,
    courseTitle: course.courseTitle,
    category: course.category,
    facultyName: course.faculty,
    slot: course.slot,
    hoursConducted: course.hoursConducted || "",
    hoursAbsent: course.hoursAbsent || "",
    attendancePercentage:
      course.attendancePercentage !== undefined
        ? course.attendancePercentage.toFixed
          ? course.attendancePercentage.toFixed(2)
          : course.attendancePercentage
        : "",
  }));

  return { regNumber, attendance };
}

exports.getAttendance = async (req, res, next) => {
  try {
    const sessionCookies = req.headers["x-session-cookies"];
    if (!sessionCookies) {
      return res.status(400).json({
        status: false,
        message: "Session cookies required in x-session-cookies header",
        errors: ["Missing session cookies"],
      });
    }
    const data = await getAttendanceOnly(sessionCookies);
    if (!data) {
      return res.status(404).json({
        status: false,
        message: "Attendance data not found or could not be parsed",
        errors: ["Data extraction failed"],
      });
    }

    const formatted = formatAttendanceResponse(data);
    return res.status(200).json({
      ...formatted,
      status: 200,
    });
  } catch (err) {
    logger.error(`Attendance fetch error: ${err.message}`);
    next(err);
  }
};
