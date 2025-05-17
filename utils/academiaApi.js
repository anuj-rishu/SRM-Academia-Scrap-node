const axios = require("axios");
const logger = require("./logger");
const cheerio = require("cheerio");

async function getSession(password, userObj) {
  try {
    const { identifier, digest } = userObj;
    const payload = JSON.stringify({ passwordauth: { password } });

    const now = Date.now();

    const apiResp = await axios({
      method: "POST",
      url: `https://academia.srmist.edu.in/accounts/p/40-10002227248/signin/v2/primary/${identifier}/password?digest=${digest}&cli_time=${now}&servicename=ZohoCreator&service_language=en&serviceurl=https://academia.srmist.edu.in/portal/academia-academic-services/redirectFromLogin`,
      headers: {
        accept: "*/*",
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        "x-zcsrf-token": "iamcsrcoo=884b99c7-829b-4ddf-8344-ce971784bbe8",
        cookie:
          "f0e8db9d3d=7ad3232c36fdd9cc324fb86c2c0a58ad; bdb5e23bb2=3fe9f31dcc0a470fe8ed75c308e52278; zccpn=221349cd-fad7-4b4b-8c16-9146078c40d5; ZCNEWUIPUBLICPORTAL=true; cli_rgn=IN; iamcsr=884b99c7-829b-4ddf-8344-ce971784bbe8; _zcsr_tmp=884b99c7-829b-4ddf-8344-ce971784bbe8; 74c3a1eecc=d06cba4b90fbc9287c4162d01e13c516;",
      },
      data: payload,
    });

    let cookieString = "";
    if (apiResp.headers["set-cookie"]) {
      cookieString = Array.isArray(apiResp.headers["set-cookie"])
        ? apiResp.headers["set-cookie"].join("; ")
        : apiResp.headers["set-cookie"];
    }

    return {
      ...apiResp.data,
      sessionCookies: cookieString,
    };
  } catch (error) {
    logger.error(`Session error: ${error.message}`);
    throw error;
  }
}

async function lookupUser(userId) {
  try {
    const userKey = userId.replace("@srmist.edu.in", "");
    const now = Date.now();

    const lookupResp = await axios({
      method: "POST",
      url: `https://academia.srmist.edu.in/accounts/p/40-10002227248/signin/v2/lookup/${userKey}@srmist.edu.in`,
      headers: {
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "x-zcsrf-token":
          "iamcsrcoo=3c59613cb190a67effa5b17eaba832ef1eddaabeb7610c8c6a518b753bc73848b483b007a63f24d94d67d14dda0eca9f0c69e027c0ebd1bb395e51b2c6291d63",
        cookie:
          "npfwg=1; npf_r=; npf_l=www.srmist.edu.in; zalb_74c3a1eecc=44130d4069ebce16724b1740d9128cae; ZCNEWUIPUBLICPORTAL=true; zalb_f0e8db9d3d=93b1234ae1d3e88e54aa74d5fbaba677; zccpn=3c59613cb190a67effa5b17eaba832ef1eddaabeb7610c8c6a518b753bc73848b483b007a63f24d94d67d14dda0eca9f0c69e027c0ebd1bb395e51b2c6291d63; zalb_3309580ed5=2f3ce51134775cd955d0a3f00a177578; CT_CSRF_TOKEN=9d0ab1e6-9f71-40fd-826e-7229d199b64d; iamcsr=3c59613cb190a67effa5b17eaba832ef1eddaabeb7610c8c6a518b753bc73848b483b007a63f24d94d67d14dda0eca9f0c69e027c0ebd1bb395e51b2c6291d63; _zcsr_tmp=3c59613cb190a67effa5b17eaba832ef1eddaabeb7610c8c6a518b753bc73848b483b007a63f24d94d67d14dda0eca9f0c69e027c0ebd1bb395e51b2c6291d63; cli_rgn=IN; JSESSIONID=E78E4C7013F0D931BD251EBA136D57AE;",
      },
      data: `mode=primary&cli_time=${now}&servicename=ZohoCreator&service_language=en&serviceurl=https%3A%2F%2Facademia.srmist.edu.in%2Fportal%2Facademia-academic-services%2FredirectFromLogin`,
    });

    return lookupResp.data;
  } catch (error) {
    logger.error(`User lookup error: ${error.message}`);
    throw error;
  }
}

async function logoutAcademia(cookieToken) {
  try {
    const resp = await axios({
      method: "POST",
      url: "https://academia.srmist.edu.in/accounts/logout",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookieToken,
      },
    });
    return resp;
  } catch (error) {
    logger.error(`Logout error: ${error.message}`);
    throw error;
  }
}

async function getProfile(sessionCookies) {
  try {
    const response = await axios({
      method: "GET",
      url: "https://academia.srmist.edu.in/srm_university/academia-academic-services/report/Student_Profile_Report?urlParams=%7B%7D",
      headers: {
        Cookie: sessionCookies,
        Accept: "*/*",
        "Accept-Language": "en-GB,en;q=0.9",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Referer: "https://academia.srmist.edu.in/",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15",
      },
    });

    const model = response.data && response.data.MODEL;
    let profile = null;

    if (
      model &&
      Array.isArray(model.DATAJSONARRAY) &&
      model.DATAJSONARRAY.length > 0
    ) {
      const data = model.DATAJSONARRAY[0];
      let photoHtml = data.Your_Photo || null;
      let photoUrl = null;

      if (photoHtml) {
        const jpegMatch = photoHtml.match(
          /download-file\?filepath=([^"&]+\.jpe?g)[^"]*/i
        );
        if (jpegMatch && jpegMatch[1]) {
          photoUrl = `https://academia.srmist.edu.in/srm_university/academia-academic-services/report/Student_Profile_Report/${data.ID}/Your_Photo/download-file?filepath=${jpegMatch[1]}`;
        } else {
          const match = photoHtml.match(/<img[^>]+src="([^"]+)"/);
          if (match && match[1]) {
            photoUrl = match[1].startsWith("http")
              ? match[1]
              : `https://academia.srmist.edu.in${match[1]}`;
          }
        }
      }

      profile = {
        registrationNumber: data.Name ? data.Name.split(" - ")[0] : null,
        name: data.Name ? data.Name.split(" - ")[1] : null,
        photoUrl,
      };
    }

    return profile;
  } catch (error) {
    logger.error(`Profile fetch error: ${error.message}`);
    throw error;
  }
}

async function getAttendance(sessionCookies) {
  try {
    const response = await axios({
      method: "GET",
      url: "https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Attendance",
      headers: {
        Cookie: sessionCookies,
        Accept: "*/*",
        "Accept-Language": "en-GB,en;q=0.9",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Referer: "https://academia.srmist.edu.in/",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15",
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    // The HTML is embedded in a JavaScript string inside the response
    const htmlContent = response.data;

    // Extract the actual HTML content from the JavaScript
    // Look for HTML content between single quotes in the sanitize function
    const htmlMatch = htmlContent.match(/pageSanitizer\.sanitize\('(.+?)'\)/s);

    if (!htmlMatch || !htmlMatch[1]) {
      logger.error("Could not extract HTML content from response");
      throw new Error("Could not extract HTML content from response");
    }

    // Unescape the HTML content - replace escape sequences
    const escapedHtml = htmlMatch[1].replace(
      /\\x([0-9A-Fa-f]{2})/g,
      (match, p1) => String.fromCharCode(parseInt(p1, 16))
    );

    // Parse the HTML with Cheerio
    const attendanceData = extractAttendanceDataWithCheerio(escapedHtml);

    return attendanceData;
  } catch (error) {
    logger.error(`Attendance fetch error: ${error.message}`);
    throw error;
  }
}

function extractAttendanceAndMarks(htmlContent) {
  const $ = cheerio.load(htmlContent);

  const studentInfo = {
    registrationNumber:
      $('tr:contains("Registration Number:")').find("strong").first().text() ||
      null,
    name: $('tr:contains("Name:")').find("strong").first().text() || null,
    program: $('tr:contains("Program:")').find("strong").first().text() || null,
    department:
      $('tr:contains("Department:")').find("strong").first().text() || null,
    specialization:
      $('tr:contains("Specialization:")').find("strong").first().text() || null,
    semester:
      $('tr:contains("Semester:")').find("strong").first().text() || null,
    batch: $('tr:contains("Batch")').find("strong").first().text() || null,
    photoUrl:
      $('td:contains("Photo-ID:")').next().find("img").attr("src") || null,
  };

  // Attendance
  const attendance = [];
  $('table[bgcolor="#FAFAD2"] tr').each((index, element) => {
    if (index === 0) return;
    const tds = $(element).find("td");
    if (tds.length >= 6) {
      const courseCodeCell = $(tds[0]).text().trim();
      const courseCode = courseCodeCell.split("\n")[0].trim();
      attendance.push({
        courseCode,
        courseTitle: $(tds[1]).text().trim(),
        category: $(tds[2]).text().trim(),
        faculty: $(tds[3]).text().trim(),
        slot: $(tds[4]).text().trim(),
        attendancePercentage: parseInt($(tds[5]).find("strong").text().trim()),
      });
    }
  });

  // Marks
  const marks = [];
  const processedCodes = new Set();
  const marksTable = $(
    'table:has(td[bgcolor="gainsboro"]:contains("Test Performance"))'
  );
  marksTable.find("tr").each((index, row) => {
    if (index === 0) return;
    const tds = $(row).find("td");
    if (tds.length >= 3) {
      const courseCode = $(tds[0]).text().trim();
      if (!/^\d{2}[A-Z]{2,}/.test(courseCode) || processedCodes.has(courseCode))
        return;
      processedCodes.add(courseCode);

      const courseType = $(tds[1]).text().trim();
      let courseTitle = "";
      const courseObj = attendance.find((c) => c.courseCode === courseCode);
      if (courseObj) courseTitle = courseObj.courseTitle;

      const tests = [];
      $(tds[2])
        .find("table tbody tr td")
        .each((i, testCell) => {
          const strong = $(testCell).find("strong").first();
          const testNameWithMax = strong.text().trim();
          if (!testNameWithMax) return;
          const testParts = testNameWithMax.split("/");
          const testName = testParts[0].trim();
          const maxMarks = testParts[1] ? testParts[1].trim() : null;
          let score = null;
          const html = $(testCell).html();
          if (html && html.includes("<br>")) {
            const afterBr = html.split("<br>")[1];
            if (afterBr) {
              score = cheerio
                .load("<div>" + afterBr + "</div>")("div")
                .text()
                .trim();
            }
          }
          if (testName && score) {
            tests.push({ testName, maxMarks, score });
          }
        });

      marks.push({
        courseCode,
        courseTitle,
        courseType,
        tests,
      });
    }
  });

  return { studentInfo, attendance, marks };
}

async function getAttendanceOnly(sessionCookies) {
  const { studentInfo, attendance } = await getAttendanceAndMarksCommon(
    sessionCookies
  );
  return { studentInfo, attendance };
}

async function getMarksOnly(sessionCookies) {
  const { studentInfo, marks } = await getAttendanceAndMarksCommon(
    sessionCookies
  );
  return { studentInfo, marks };
}

async function getAttendanceAndMarksCommon(sessionCookies) {
  const response = await axios({
    method: "GET",
    url: "https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Attendance",
    headers: {
      Cookie: sessionCookies,
      Accept: "*/*",
      "Accept-Language": "en-GB,en;q=0.9",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Referer: "https://academia.srmist.edu.in/",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15",
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  const htmlContent = response.data;
  const htmlMatch = htmlContent.match(/pageSanitizer\.sanitize\('(.+?)'\)/s);
  if (!htmlMatch || !htmlMatch[1])
    throw new Error("Could not extract HTML content from response");
  const escapedHtml = htmlMatch[1].replace(
    /\\x([0-9A-Fa-f]{2})/g,
    (match, p1) => String.fromCharCode(parseInt(p1, 16))
  );
  return extractAttendanceAndMarks(escapedHtml);
}

module.exports = {
  getSession,
  lookupUser,
  logoutAcademia,
  getProfile,
  getAttendance,
  getAttendanceOnly,
  getMarksOnly,
};
