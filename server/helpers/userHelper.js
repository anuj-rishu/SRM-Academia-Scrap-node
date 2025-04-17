const axios = require("axios");
const cheerio = require("cheerio");
const { extractCookies } = require("../utils/extractUtils");
const ProfileFetcher = require("./profileHelper");

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
  }
}

function convertHexToHTML(hexString) {
  if (!hexString) return "";
  return hexString.replace(/\\x([0-9A-Fa-f]{2})/g, (match, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
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
  if (currentMonth >= 7) academicYear++;
  let studentYear = academicYear - academicYearLastTwoDigits;
  if (academicYearLastTwoDigits > currentYearLastTwoDigits) studentYear--;
  return studentYear;
}

async function getUserFromHTML(rawPage) {
  const regNumberMatch = rawPage.match(/RA2\d{12}/);
  const regNumber = regNumberMatch ? regNumberMatch[0] : "";
  const $ = cheerio.load(rawPage);

  const userData = {
    name: "",
    mobile: "",
    program: "",
    semester: 0,
    regNumber,
    batch: "",
    year: getYear(regNumber),
    department: "",
    section: "",
    advisors: [],
  };

  $(
    'table[border="0"][align="left"][cellpadding="1"][cellspacing="1"][style*="width:900px"] tr'
  ).each((i, row) => {
    const cells = $(row).find("td");
    for (let i = 0; i < cells.length; i += 2) {
      const key = $(cells[i]).text().trim().replace(":", "");
      const value = $(cells[i + 1]).text().trim();
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
          if (deptParts.length > 0) userData.department = deptParts[0].trim();
          if (deptParts.length > 1) {
            let section = deptParts[1].trim();
            section = section.replace(/^\(/, "").replace(/ Section\)$/, "");
            userData.section = section;
          }
          break;
      }
    }
  });

  const facultyAdvisorPattern =
    /strong>([^<]+)<br\/>Faculty Advisor<\/strong><br\/><font color="blue">([^<]+)<\/font><br\/><font color="green">(\d+)/;
  const facultyMatch = rawPage.match(facultyAdvisorPattern);

  const academicAdvisorPattern =
    /strong>([^<]+)<br\/>Academic Advisor<\/strong><br\/><font color="blue">([^<]+)<\/font><br\/><font color="green">(\d+)/;
  const academicMatch = rawPage.match(academicAdvisorPattern);

  if (facultyMatch) {
    userData.advisors.push({
      name: facultyMatch[1].trim(),
      role: "Faculty Advisor",
      email: facultyMatch[2].trim(),
      phone: facultyMatch[3].trim(),
    });
  }
  if (academicMatch) {
    userData.advisors.push({
      name: academicMatch[1].trim(),
      role: "Academic Advisor",
      email: academicMatch[2].trim(),
      phone: academicMatch[3].trim(),
    });
  }

  return userData;
}

async function getUserWithPhoto(cookie) {
  const coursePage = new CoursePage(cookie);
  const rawPage = await coursePage.getPage();
  const userData = await getUserFromHTML(rawPage);

  const profileFetcher = new ProfileFetcher(cookie);
  const profileData = await profileFetcher.getProfile();

  if (profileData && profileData.status === 200) {
    if (profileData.photoUrl) userData.photoUrl = profileData.photoUrl;
    if (profileData.photoBase64) userData.photoBase64 = profileData.photoBase64;
  }

  return userData;
}

module.exports = {
  CoursePage,
  getUserFromHTML,
  getUserWithPhoto,
};