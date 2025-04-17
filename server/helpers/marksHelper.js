const axios = require("axios");
const cheerio = require("cheerio");
const { extractCookies, convertHexToHTML } = require("../utils/extractUtils");
const AcademicsFetch = require("./attendanceHelper");

class MarksFetcher extends AcademicsFetch {
  constructor(cookie) {
    super(cookie);
  }

  parseFloat(s) {
    if (!s || s === "Abs") return 0;
    const num = parseFloat(s);
    return isNaN(num) ? 0 : num;
  }

  async getMarks() {
    try {
      const html = await this.getHTML();
      return await this.scrapeMarks(html);
    } catch (error) {
      return {
        status: 500,
        error: error.message,
      };
    }
  }

  async scrapeMarks(html) {
    // Use attendance parsing for regNumber and course map
    const attendanceData = await this.scrapeAttendance(html);
    if (!attendanceData || !attendanceData.attendance) {
      return {
        regNumber: attendanceData ? attendanceData.regNumber : "",
        marks: [],
        status: 200,
      };
    }

    const courseMap = {};
    for (const att of attendanceData.attendance) {
      courseMap[att.courseCode] = att.courseTitle;
    }

    // Extract marks table efficiently
    let marksHtml = "";
    const parts = html.split(
      '<table border="1" align="center" cellpadding="1" cellspacing="1">'
    );
    if (parts.length > 1) {
      marksHtml = parts[1].split(
        '<table  width=800px;"border="0"cellspacing="1"cellpadding="1">'
      )[0];
      marksHtml = marksHtml.split("<br />")[0];
      marksHtml =
        '<table border="1" align="center" cellpadding="1" cellspacing="1">' +
        marksHtml;
    } else {
      return {
        regNumber: attendanceData.regNumber,
        marks: [],
        status: 200,
      };
    }

    const $ = cheerio.load(marksHtml);
    const marks = [];

    $("tr").each((index, row) => {
      if (index === 0) return;
      const cells = $(row).find("td");
      if (cells.length < 3) return;

      const courseCode = cells.eq(0).text().trim();
      const courseType = cells.eq(1).text().trim();
      if (!courseCode) return;

      const testCell = cells.eq(2);
      let testPerformance = [];
      let overallScored = 0;
      let overallTotal = 0;

      testCell.find("table td").each((i, testElement) => {
        const testText = $(testElement).text().trim().split(".00");
        if (testText.length >= 2) {
          const testNameParts = testText[0].split("/");
          const testTitle = testNameParts[0].trim();
          const total = this.parseFloat(testNameParts[1]);
          let scored = testText[1].trim() === "Abs" ? "Abs" : this.parseFloat(testText[1]);

          testPerformance.push({
            test: testTitle,
            marks: {
              scored: scored === "Abs" ? "Abs" : scored.toFixed(2),
              total: total.toFixed(2),
            },
          });

          if (scored !== "Abs") {
            overallScored += scored;
            overallTotal += total;
          } else {
            overallTotal += total;
          }
        }
      });

      marks.push({
        courseName: courseMap[courseCode] || courseCode,
        courseCode,
        courseType,
        overall: {
          scored: overallScored.toFixed(2),
          total: overallTotal.toFixed(2),
        },
        testPerformance,
      });
    });

    // Sort: Theory first, then Practical
    const sortedMarks = [
      ...marks.filter((m) => m.courseType === "Theory"),
      ...marks.filter((m) => m.courseType === "Practical"),
    ];

    return {
      regNumber: attendanceData.regNumber,
      marks: sortedMarks,
      status: 200,
    };
  }
}

module.exports = MarksFetcher;