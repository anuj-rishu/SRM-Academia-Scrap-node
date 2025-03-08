const axios = require("axios");
const cheerio = require("cheerio");
const { extractCookies } = require("../utils/extractUtils");

class CoursePage {
  constructor(cookie) {
    this.cookie = cookie;
  }

  getUrl() {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    let academicYearStart, academicYearEnd;

    if (currentMonth >= 8 && currentMonth <= 12) {
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

  async getPage() {
    try {
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
          Referer: "https://academia.srmist.edu.in/",
          "Referrer-Policy": "strict-origin-when-cross-origin",
          "Cache-Control": "private, max-age=120, must-revalidate",
          cookie: extractCookies(this.cookie),
        },
      });

      const data = response.data;
      const parts = data.split(".sanitize('");

      if (parts.length < 2) {
        throw new Error("user - invalid response format");
      }

      const htmlHex = parts[1].split("')")[0];
      return convertHexToHTML(htmlHex);
    } catch (error) {
      console.error("Error fetching HTML:", error);
      throw error;
    }
  }
}

function convertHexToHTML(hexString) {
  if (!hexString) return "";

  return hexString.replace(/\\x([0-9A-Fa-f]{2})/g, (match, hex) => {
    const val = parseInt(hex, 16);
    return String.fromCharCode(val);
  });
}

function getYear(registrationNumber) {
  if (!registrationNumber || registrationNumber.length < 4) return 0;

  const yearString = registrationNumber.substring(2, 4);
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYearLastTwoDigits = currentYear % 100;

  const academicYearLastTwoDigits = parseInt(yearString, 10);

  let academicYear = currentYearLastTwoDigits;
  if (currentMonth >= 7) {
    academicYear++;
  }

  let studentYear = academicYear - academicYearLastTwoDigits;

  if (academicYearLastTwoDigits > currentYearLastTwoDigits) {
    studentYear--;
  }

  return studentYear;
}

async function getUserFromHTML(rawPage) {
  try {
    const regNumberMatch = rawPage.match(/RA2\d{12}/);
    const regNumber = regNumberMatch ? regNumberMatch[0] : "";

    const tableParts = rawPage.split(
      '<table border="0" align="left" cellpadding="1" cellspacing="1" style="width:900px;">'
    );
    if (tableParts.length < 2) {
      throw new Error("User table not found in HTML");
    }

    const tableHtml = tableParts[1].split("</table>")[0];
    const fullTableHtml =
      '<table border="0" align="left" cellpadding="1" cellspacing="1" style="width:900px;">' +
      tableHtml +
      "</table>";

    const $ = cheerio.load(fullTableHtml);
    const userData = {
      name: "",
      mobile: "",
      program: "",
      semester: 0,
      regNumber: regNumber,
      batch: "",
      year: getYear(regNumber),
      department: "",
      section: "",
    };

    $("tr").each((i, row) => {
      const cells = $(row).find("td");
      for (let i = 0; i < cells.length; i += 2) {
        const key = $(cells[i]).text().trim().replace(":", "");
        const value = $(cells[i + 1])
          .text()
          .trim();

        switch (key) {
          case "Name":
            userData.name = value;
            break;
          case "Program":
            userData.program = value;
            break;
          case "Batch":
            userData.batch = value;
            break;
          case "Mobile":
            userData.mobile = value;
            break;
          case "Semester":
            userData.semester = parseInt(value, 10) || 0;
            break;
          case "Department":
            const deptParts = value.split("-");
            if (deptParts.length > 0) {
              userData.department = deptParts[0].trim();
            }
            if (deptParts.length > 1) {
              let section = deptParts[1].trim();
              section = section.replace(/^\(/, "").replace(/ Section\)$/, "");
              userData.section = section;
            }
            break;
        }
      }
    });

    return userData;
  } catch (error) {
    console.error("Error parsing user data:", error);
    throw error;
  }
}

module.exports = {
  CoursePage,
  getUserFromHTML,
};
