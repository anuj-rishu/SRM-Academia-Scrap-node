const { getMarksOnly } = require("../utils/academiaApi");
const logger = require("../utils/logger");

function formatMarksResponse(data) {
  const regNumber = data.studentInfo.registrationNumber || null;
  const marks = (data.marks || []).map((course) => {
    let overallScored = 0,
      overallTotal = 0;
    const testPerformance = (course.tests || []).map((test) => {
      const scored = parseFloat(test.score) || 0;
      const total = parseFloat(test.maxMarks) || 0;
      overallScored += scored;
      overallTotal += total;
      return {
        test: test.testName,
        marks: {
          scored: test.score,
          total: test.maxMarks,
        },
      };
    });

    return {
      courseName: course.courseTitle,
      courseCode: course.courseCode,
      courseType: course.courseType,
      overall: {
        scored: overallScored.toFixed(2),
        total: overallTotal.toFixed(2),
      },
      testPerformance,
    };
  });

  return { regNumber, marks };
}

exports.getMarks = async (req, res, next) => {
  try {
    const sessionCookies = req.headers["x-session-cookies"];
    if (!sessionCookies) {
      return res.status(400).json({
        status: false,
        message: "Session cookies required in x-session-cookies header",
        errors: ["Missing session cookies"],
      });
    }
    const data = await getMarksOnly(sessionCookies);
    if (!data) {
      return res.status(404).json({
        status: false,
        message: "Marks data not found or could not be parsed",
        errors: ["Data extraction failed"],
      });
    }

    const formatted = formatMarksResponse(data);
    return res.status(200).json({
      ...formatted,
      status: 200,
    });
  } catch (err) {
    logger.error(`Marks fetch error: ${err.message}`);
    next(err);
  }
};
