const axios = require("axios");
const cheerio = require("cheerio");
const { extractCookies, convertHexToHTML } = require("../utils/extractUtils");

class AcademicsFetch {
  constructor(cookie) {
    this.cookie = cookie;
  }

  async getHTML() {
    const response = await axios({
      method: "GET",
      url: "https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Attendance",
      headers: {
        "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        Referer: "https://academia.srmist.edu.in/",
        cookie: extractCookies(this.cookie),
      },
    });

    const data = response.data;
    const match = data.match(/\.sanitize\('([^']+)'\)/);
    if (!match) throw new Error("attendance - invalid response format");
    return convertHexToHTML(match[1]);
  }

  async getAttendance() {
    try {
      const html = await this.getHTML();
      return this.scrapeAttendance(html);
    } catch (error) {
      return {
        status: 500,
        error: error.message,
      };
    }
  }

  parseFloatSafe(s) {
    const num = parseFloat(s);
    return isNaN(num) ? 0 : num;
  }

  scrapeAttendance(html) {
    const regNumberMatch = html.match(/RA2\d{12}/);
    const regNumber = regNumberMatch ? regNumberMatch[0] : "";

    // Remove unnecessary cells
    let processedHtml = html.replace(
      /<td  bgcolor='#E6E6FA' style='text-align:center'> - <\/td>/g,
      ""
    );

    // Extract the attendance table directly
    const tableMatch = processedHtml.match(
      /<table style="font-size :16px;"[^>]*>[\s\S]*?<\/table>/
    );
    if (!tableMatch) return { regNumber, attendance: [], status: 200 };

    const $ = cheerio.load(tableMatch[0]);
    const attendance = [];

    $('tr').each((_, row) => {
      const cells = $(row).find('td[bgcolor="#E6E6FA"]');
      if (cells.length === 0) return;

      const courseCode = $(cells[0]).text();
      if (
        (courseCode.length > 10 && /^\d/.test(courseCode)) ||
        courseCode.toLowerCase().includes("regular")
      ) {
        const allCells = $(row).find("td");
        const courseTitle = $(allCells[1]).text().split(" \\u2013")[0];
        if (courseTitle.toLowerCase() === "null") return;

        const attendanceItem = {
          courseCode: courseCode.replace("Regular", ""),
          courseTitle,
          category: $(allCells[2]).text(),
          facultyName: $(allCells[3]).text(),
          slot: $(allCells[4]).text(),
          hoursConducted: $(allCells[5]).text(),
          hoursAbsent: $(allCells[6]).text(),
        };

        const conductedNum = this.parseFloatSafe(attendanceItem.hoursConducted);
        const absentNum = this.parseFloatSafe(attendanceItem.hoursAbsent);
        attendanceItem.attendancePercentage =
          conductedNum !== 0
            ? (((conductedNum - absentNum) / conductedNum) * 100).toFixed(2)
            : "0.00";

        attendance.push(attendanceItem);
      }
    });

    return {
      regNumber,
      attendance,
      status: 200,
    };
  }
}

module.exports = AcademicsFetch;