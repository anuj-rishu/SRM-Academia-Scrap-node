const axios = require("axios");
const cheerio = require("cheerio");
const { extractCookies, convertHexToHTML } = require("../utils/extractUtils");

let Course, CourseResponse;
try {
  const courseTypes = require("../types/course");
  Course = courseTypes.Course;
  CourseResponse = courseTypes.CourseResponse;
} catch (err) {
  Course = class Course {
    constructor() {
      this.code = "";
      this.title = "";
      this.credit = "";
      this.category = "";
      this.courseCategory = "";
      this.type = "";
      this.slotType = "";
      this.faculty = "";
      this.slot = "";
      this.room = "";
      this.academicYear = "";
    }
  };

  CourseResponse = class CourseResponse {
    constructor(regNumber = "", courses = [], status = 200, error = "") {
      this.regNumber = regNumber;
      this.courses = courses;
      this.status = status;
      this.error = error;
    }
  };
}

class CourseFetcher {
  constructor(cookie) {
    this.cookie = cookie;
  }

  getUrl() {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    let academicYearStart, academicYearEnd;
    if (currentMonth >= 7 && currentMonth <= 11) {
      academicYearStart = currentYear - 1;
      academicYearEnd = currentYear;
    } else {
      academicYearStart = currentYear - 2;
      academicYearEnd = currentYear - 1;
    }
    return `https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Time_Table_${academicYearStart}_${
      academicYearEnd % 100
    }`;
  }

  async getHTML() {
    const response = await axios({
      method: "GET",
      url: this.getUrl(),
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "x-requested-with": "XMLHttpRequest",
        cookie: extractCookies(this.cookie),
        Referer: "https://academia.srmist.edu.in/",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Cache-Control": "private, max-age=120, must-revalidate",
      },
    });

    const data = response.data;
    const parts = data.split(".sanitize('");
    if (parts.length < 2) throw new Error("courses - invalid response format");
    const htmlHex = parts[1].split("')")[0];
    return convertHexToHTML(htmlHex);
  }

  async getCourses() {
    try {
      const html = await this.getHTML();
      return this.scrapeCourses(html);
    } catch (error) {
      const response = new CourseResponse();
      response.status = 500;
      response.error = error.message;
      return response;
    }
  }

  scrapeCourses(html) {
    const regNumberMatch = html.match(/RA2\d{12}/);
    const regNumber = regNumberMatch ? regNumberMatch[0] : "";

    let courseTableHtml = "";
    const tableParts = html.split(
      '<table cellspacing="1" cellpadding="1" border="1" align="center" style="width:900px!important;" class="course_tbl">'
    );
    if (tableParts.length > 1) {
      courseTableHtml = tableParts[1].split("</table>")[0];
      courseTableHtml = "<table>" + courseTableHtml + "</table>";
    } else {
      return new CourseResponse(regNumber, [], 200);
    }

    const $ = cheerio.load(courseTableHtml);
    const courses = [];

    $("tr").each((index, row) => {
      if (index === 0) return;
      const cells = $(row).find("td");
      if (cells.length < 11) return;

      // Cache cell values for faster access
      const cellVals = [];
      for (let i = 0; i < 11; i++) {
        cellVals[i] = $(cells[i]).text().trim();
      }

      let slot = cellVals[8].replace(/-$/, "");
      let room = cellVals[9] || "N/A";
      if (room !== "N/A") room = room.charAt(0).toUpperCase() + room.slice(1);

      const course = new Course();
      course.code = cellVals[1];
      course.title = cellVals[2].split(" \\u2013")[0];
      course.credit = cellVals[3] || "N/A";
      course.category = cellVals[4];
      course.courseCategory = cellVals[5];
      course.type = cellVals[6] || "N/A";
      course.slotType = slot.includes("P") ? "Practical" : "Theory";
      course.faculty = cellVals[7] || "N/A";
      course.slot = slot;
      course.room = room;
      course.academicYear = cellVals[10];

      courses.push(course);
    });

    const response = new CourseResponse();
    response.regNumber = regNumber;
    response.courses = courses;
    return response;
  }
}

module.exports = CourseFetcher;
module.exports.CoursePage = CourseFetcher;