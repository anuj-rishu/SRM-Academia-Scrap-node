const axios = require("axios");
const cheerio = require("cheerio");
const { extractCookies, convertHexToHTML } = require("../utils/extractUtils");
const fs = require("fs");

class FeedbackFetch {
  constructor(cookie) {
    this.cookie = cookie;
  }

  async getFormData() {
    try {
      console.log("Fetching feedback form...");
      const response = await this.getHTML();

      this.saveResponseForDebugging(response.data);

      console.log(`Response type: ${typeof response.data}`);
      console.log(
        `Response length: ${
          typeof response.data === "string"
            ? response.data.length
            : "not a string"
        }`
      );

      // Process the response
      return this.parseFeedbackForm(response);
    } catch (error) {
      console.error("Feedback fetch error:", error.message);
      return {
        status: error.response?.status || 500,
        error: error.message,
        details: error.response?.data
          ? "Response data available"
          : "No response data",
      };
    }
  }

  // Save response for debugging purposes
  saveResponseForDebugging(data) {
    try {
      const content =
        typeof data === "string" ? data : JSON.stringify(data, null, 2);
      fs.writeFileSync("./feedback-response-debug.txt", content);
      console.log("Debug: Response saved to feedback-response-debug.txt");
    } catch (err) {
      console.log("Could not save debug file:", err.message);
    }
  }

  async getHTML() {
    const url =
      "https://academia.srmist.edu.in/srm_university/academia-academic-services/form/Student_Feedback_Form?zc_Header=false&zc_SuccMsg=Data%20Added%20Successfully!&zc_SubmitVal=Submit&zc_ResetVal=Reset&viewLinkName=Student_Feedback_Report&recLinkID=2727643000342912437&zc_LoadIn=html";

    try {
      console.log(`Requesting URL: ${url}`);
      const response = await axios({
        method: "GET",
        url: url,
        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15",
          Referer:
            "https://academia.srmist.edu.in/srm_university/academia-academic-services/home",
          "X-Requested-With": "XMLHttpRequest",
          Cookie: extractCookies(this.cookie),
        },
        responseType: "text",
        timeout: 30000,
        maxRedirects: 5,
      });

      console.log(`Feedback form response status: ${response.status}`);

      if (response.status >= 400) {
        throw new Error(
          `Failed to fetch feedback form: HTTP ${response.status}`
        );
      }

      return response;
    } catch (error) {
      console.error("Error fetching HTML:", error.message);
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
      }
      throw error;
    }
  }

  parseFeedbackForm(response) {
    try {
      const responseData = response.data;
      let jsonData;

      if (typeof responseData === "string") {
        try {
          const sanitizeMatch = responseData.match(/\.sanitize\('([^']+)'\)/);
          if (sanitizeMatch) {
            const sanitized = convertHexToHTML(sanitizeMatch[1]);
            jsonData = JSON.parse(sanitized);
          } else if (responseData.trim().startsWith("{")) {
            jsonData = JSON.parse(responseData);
          }
        } catch (e) {
          console.log("Not a valid JSON:", e.message);
        }
      } else if (typeof responseData === "object") {
        jsonData = responseData;
      }

      if (jsonData && jsonData.RECORD) {
        const feedbackData = this.extractCoursesFromJson(jsonData);
        return {
          feedbackData,
          status: 200,
        };
      }

      if (typeof responseData === "string") {
        const htmlResult = this.parseHtmlContent(responseData);
        if (
          htmlResult.feedbackData &&
          (htmlResult.feedbackData.theoryFeedbackCourses?.length > 0 ||
            htmlResult.feedbackData.practicalFeedbackCourses?.length > 0)
        ) {
          return htmlResult;
        }
      }

      const courseInfo = this.extractCourseInfoByPattern(responseData);

      return {
        feedbackData: {
          studentInfo: {
            registrationNumber: this.extractRegNumber(responseData),
          },
          academicYear: "Current Academic Year",
          feedbackNumber: "Current Feedback",
          theoryFeedbackCourses: courseInfo.theoryFeedbackCourses,
          practicalFeedbackCourses: courseInfo.practicalFeedbackCourses,
          isCompleted: false,
        },
        status: 200,
      };
    } catch (error) {
      console.error("Error parsing feedback form:", error.message);
      return {
        status: 500,
        error: "Failed to parse feedback form",
        details: error.message,
      };
    }
  }

  extractCoursesFromJson(jsonData) {
    console.log("Extracting courses from JSON record");
    const regNumber = this.extractRegNumberFromJson(jsonData);

    const theoryFeedbackCourses = [];
    const practicalFeedbackCourses = [];

    if (jsonData.RECORD?.Enter_Your_Feedback_Here_Theory?.SUBFORM_RECORDS) {
      const theoryCourses =
        jsonData.RECORD.Enter_Your_Feedback_Here_Theory.SUBFORM_RECORDS;

      theoryCourses.forEach((course, index) => {
        if (index === 0 || !course.Course_Code?.FIELDVALUE) return;

        const courseCodeText =
          typeof course.Course_Code.FIELDVALUE === "object"
            ? course.Course_Code.FIELDVALUE.text
            : course.Course_Code.FIELDVALUE;

        if (!courseCodeText) return;

        const courseCodeMatch = courseCodeText.match(/^([A-Z0-9]{7,10})/);
        if (courseCodeMatch) {
          const courseData = {
            courseCode: courseCodeMatch[1],
            courseName: courseCodeText
              .replace(courseCodeMatch[1], "")
              .replace(/^[:\s-]+/, ""),
            courseFields: {},
          };

          theoryFeedbackCourses.push(courseData);
        }
      });
    }

    if (jsonData.RECORD?.Enter_Your_Feedback_Here_Practical?.SUBFORM_RECORDS) {
      const practicalCourses =
        jsonData.RECORD.Enter_Your_Feedback_Here_Practical.SUBFORM_RECORDS;

      practicalCourses.forEach((course, index) => {
        if (index === 0 || !course.Course_Code?.FIELDVALUE) return;

        const courseCodeText =
          typeof course.Course_Code.FIELDVALUE === "object"
            ? course.Course_Code.FIELDVALUE.text
            : course.Course_Code.FIELDVALUE;

        if (!courseCodeText) return;

        const courseCodeMatch = courseCodeText.match(/^([A-Z0-9]{7,10})/);
        if (courseCodeMatch) {
          const courseData = {
            courseCode: courseCodeMatch[1],
            courseName: courseCodeText
              .replace(courseCodeMatch[1], "")
              .replace(/^[:\s-]+/, ""),
            courseFields: {},
          };

          practicalFeedbackCourses.push(courseData);
        }
      });
    }

    console.log(
      `Found ${theoryFeedbackCourses.length} theory courses and ${practicalFeedbackCourses.length} practical courses`
    );

    return {
      studentInfo: {
        registrationNumber: regNumber,
      },
      academicYear:
        jsonData.RECORD?.Academic_Year?.FIELDVALUE?.text ||
        jsonData.RECORD?.Academic_Year?.FIELDVALUE ||
        "Current Academic Year",
      feedbackNumber:
        jsonData.RECORD?.Feedback_Number?.FIELDVALUE || "Current Feedback",
      theoryFeedbackCourses,
      practicalFeedbackCourses,
      isCompleted: jsonData.RECORD?.is_Completed?.FIELDVALUE === "true",
    };
  }

  extractRegNumberFromJson(jsonData) {
    if (jsonData.RECORD?.Registration_Number?.FIELDVALUE) {
      const regValue = jsonData.RECORD.Registration_Number.FIELDVALUE;
      if (typeof regValue === "object" && regValue.text) {
        const match = regValue.text.match(/(RA\d{13})/);
        return match ? match[1] : regValue.text.split(" ")[0];
      } else if (typeof regValue === "string") {
        return regValue;
      }
    }
    return "";
  }

  extractCourseInfoByPattern(content) {
    try {
      if (!content || typeof content !== "string") {
        return { theoryFeedbackCourses: [], practicalFeedbackCourses: [] };
      }

      const courseCodePattern =
        /\b((?:18|19|20|21|22|23)[A-Z]{2,4}\d{3}[A-Z]?)\b/g;
      const matches = content.match(courseCodePattern) || [];

      const filteredMatches = matches.filter((code) => {
        return !code.includes("AY20");
      });

      const uniqueCodes = [...new Set(filteredMatches)];
      console.log(
        `Found ${uniqueCodes.length} potential course codes: ${uniqueCodes.join(
          ", "
        )}`
      );

      const theoryFeedbackCourses = [];
      const practicalFeedbackCourses = [];

      uniqueCodes.forEach((courseCode) => {
        const courseNameRegex = new RegExp(
          `${courseCode}\\s*[-:]?\\s*([\\w\\s\\-&.,()]{5,50})`,
          "i"
        );
        const courseNameMatch = content.match(courseNameRegex);
        let courseName = courseNameMatch ? courseNameMatch[1].trim() : "";

        if (courseName) {
          courseName = courseName
            .replace(/[.,;:]+\s*$/, "")
            .replace(/\(.*$/, "")
            .trim();
        }

        const surroundingContext = this.getTextSurroundingPattern(
          content,
          courseCode,
          100
        );
        const isPractical =
          courseCode.endsWith("L") ||
          surroundingContext.includes("LAB") ||
          surroundingContext.toLowerCase().includes("lab") ||
          surroundingContext.toLowerCase().includes("practical") ||
          (courseName &&
            (courseName.toLowerCase().includes("lab") ||
              courseName.toLowerCase().includes("practical")));

        const courseData = {
          courseCode,
          courseName,
          courseFields: {},
        };

        if (isPractical) {
          practicalFeedbackCourses.push(courseData);
        } else {
          theoryFeedbackCourses.push(courseData);
        }
      });

      return {
        theoryFeedbackCourses,
        practicalFeedbackCourses,
      };
    } catch (error) {
      console.error("Error extracting courses by pattern:", error.message);
      return { theoryFeedbackCourses: [], practicalFeedbackCourses: [] };
    }
  }

  getTextSurroundingPattern(content, pattern, charCount = 50) {
    const index = content.indexOf(pattern);
    if (index === -1) return "";

    const start = Math.max(0, index - charCount);
    const end = Math.min(content.length, index + pattern.length + charCount);

    return content.substring(start, end);
  }

  parseHtmlContent(html) {
    try {
      const $ = cheerio.load(html);

      if ($("body").text().trim().length === 0) {
        return {
          status: 200,
          feedbackData: {
            message: "Empty feedback form or no active feedback session",
          },
        };
      }

      const registrationInfo = $("body").text();

      const feedbackData = {
        studentInfo: {
          registrationNumber: this.extractRegNumber(registrationInfo),
        },
        academicYear: "Current Academic Year",
        feedbackNumber: "Current Feedback",
        theoryFeedbackCourses: [],
        practicalFeedbackCourses: [],
        isCompleted: false,
      };

      const courseInfo = this.extractCourseInfoByPattern($("body").text());
      feedbackData.theoryFeedbackCourses = courseInfo.theoryFeedbackCourses;
      feedbackData.practicalFeedbackCourses =
        courseInfo.practicalFeedbackCourses;

      return {
        feedbackData,
        status: 200,
      };
    } catch (error) {
      console.error("Error parsing HTML:", error.message);
      return {
        status: 500,
        error: "Failed to parse HTML content",
        details: error.message,
      };
    }
  }

  extractRegNumber(text) {
    if (!text || typeof text !== "string") return "";

    const regMatch = text.match(/RA\d{13}/i);
    return regMatch ? regMatch[0].toUpperCase() : "";
  }
}

module.exports = FeedbackFetch;
