const axios = require("axios");
const cheerio = require("cheerio");
const { extractCookies } = require("../utils/extractUtils");

class ProfileFetcher {
  constructor(cookie) {
    this.cookie = cookie;
    this.baseUrl = "https://academia.srmist.edu.in";
    this.debug = false;
  }

  log(...args) {
    if (this.debug) {
      console.log(...args);
    }
  }

  async getProfileData() {
    try {
      const response = await axios({
        method: "GET",
        url: `${this.baseUrl}/srm_university/academia-academic-services/report/Student_Profile_Report?urlParams=%7B%7D`,
        headers: {
          accept: "*/*",
          "accept-language": "en-US,en;q=0.9",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "x-requested-with": "XMLHttpRequest",
          Referer: `${this.baseUrl}/`,
          cookie: extractCookies(this.cookie),
        },
        responseType: "text",
      });

      if (!response.data) {
        return { status: 204, message: "No content received from server" };
      }

      try {
        return JSON.parse(response.data);
      } catch {
        return { HTML: response.data };
      }
    } catch (error) {
      return { status: 500, error: error.message };
    }
  }

  fixPhotoUrl(url, studentId) {
    if (!url) return null;

    url = url.replace(/&amp;/g, "&").trim();

    if (url.startsWith("/")) {
      return `${this.baseUrl}${url}`;
    }

    if (
      url.includes("filepath=") &&
      url.includes("digestValue=") &&
      !url.includes("://") &&
      !url.startsWith("/")
    ) {
      if (studentId) {
        return `${this.baseUrl}/srm_university/academia-academic-services/report/Student_Profile_Report/${studentId}/Your_Photo/download-file?${url}`;
      }
    }

    return url;
  }

  extractPhotoFromJsonField(htmlString, studentId) {
    if (!htmlString || typeof htmlString !== "string") return null;

    try {
      const $ = cheerio.load(htmlString);
      const img = $("img");

      if (img.length === 0) return null;

      const photoUrl =
        img.attr("downqual") || img.attr("src") || img.attr("lowqual");

      if (photoUrl) {
        return this.fixPhotoUrl(photoUrl, studentId);
      }

      return null;
    } catch (error) {
      console.error("Error parsing HTML from JSON field:", error.message);
      return null;
    }
  }

  extractPhotoUrlFromHTML(html, studentId) {
    if (!html) return null;

    this.log("Extracting photo URL from HTML content");

    const downqualMatch = html.match(/downqual="([^"]*\/Your_Photo\/[^"]+)"/);
    if (downqualMatch && downqualMatch[1]) {
      this.log("Found photo URL via downqual attribute");
      return this.fixPhotoUrl(downqualMatch[1], studentId);
    }

    const srcMatch = html.match(/src="([^"]*\/Your_Photo\/[^"]+)"/);
    if (srcMatch && srcMatch[1]) {
      this.log("Found photo URL via src attribute with Your_Photo path");
      return this.fixPhotoUrl(srcMatch[1], studentId);
    }

    const $ = cheerio.load(html);
    const imgElement = $("img.zc-image-view");
    if (imgElement.length > 0) {
      const downqual = imgElement.attr("downqual");
      if (downqual) {
        this.log("Found photo URL via img.zc-image-view downqual attribute");
        return this.fixPhotoUrl(downqual, studentId);
      }

      const src = imgElement.attr("src");
      if (src) {
        this.log("Found photo URL via img.zc-image-view src attribute");
        return this.fixPhotoUrl(src, studentId);
      }
    }

    const filepathMatch = html.match(/filepath=([^"&\s]+)/);
    const digestMatch = html.match(/digestValue=([^"&\s]+)/);
    if (filepathMatch && digestMatch && studentId) {
      this.log("Constructing photo URL from filepath and digestValue");
      return `${this.baseUrl}/srm_university/academia-academic-services/report/Student_Profile_Report/${studentId}/Your_Photo/download-file?filepath=${filepathMatch[1]}&digestValue=${digestMatch[1]}`;
    }

    const downloadMatch = html.match(/\/download-file\?([^"']+)/);
    if (downloadMatch) {
      this.log("Found download-file URL pattern");
      const queryParams = downloadMatch[1];
      return this.fixPhotoUrl(
        `/srm_university/academia-academic-services/report/Student_Profile_Report/${studentId}/Your_Photo/download-file?${queryParams}`,
        studentId
      );
    }

    this.log("No photo URL found in HTML content");
    return null;
  }

  constructDirectPhotoUrl(studentId) {
    if (!studentId) return null;

    return `${this.baseUrl}/srm_university/academia-academic-services/report/Student_Profile_Report/${studentId}/Your_Photo/download-file`;
  }

  extractRegNumber(text) {
    if (!text || typeof text !== "string") return null;

    const regNumberMatch = text.match(/RA2\d{12}/);
    return regNumberMatch ? regNumberMatch[0] : null;
  }

  async getProfile() {
    try {
      const profileData = await this.getProfileData();

      if (profileData.status && profileData.status !== 200) {
        return profileData;
      }

      const studentData = {
        id: "",
        name: "",
        photoUrl: null,
        photoBase64: null,
        regNumber: "",
        status: 200,
      };

      if (!profileData || (!profileData.MODEL && !profileData.HTML)) {
        console.error("Invalid profile data received");
        return studentData;
      }

      if (
        profileData.MODEL &&
        profileData.MODEL.DATAJSONARRAY &&
        profileData.MODEL.DATAJSONARRAY.length > 0
      ) {
        const userData = profileData.MODEL.DATAJSONARRAY[0];

        studentData.id = userData.unformattedID || userData.ID || "";
        studentData.name = userData.Name || "";

        studentData.regNumber = this.extractRegNumber(userData.Name) || "";

        this.log(
          `Extracted student ID: ${studentData.id}, Name: ${studentData.name}`
        );

        if (userData.Your_Photo && typeof userData.Your_Photo === "string") {
          this.log("Using NEW strategy 0: Direct JSON field extraction");
          studentData.photoUrl = this.extractPhotoFromJsonField(
            userData.Your_Photo,
            studentData.id
          );

          if (studentData.photoUrl) {
            this.log(
              `Successfully extracted photo URL from JSON field: ${studentData.photoUrl}`
            );
          }
        }

        if (
          !studentData.photoUrl &&
          userData.Your_Photo &&
          typeof userData.Your_Photo === "string"
        ) {
          this.log("Using strategy 1: Parse Your_Photo field");
          studentData.photoUrl = this.extractPhotoUrlFromHTML(
            userData.Your_Photo,
            studentData.id
          );
        }

        if (!studentData.photoUrl && profileData.HTML) {
          this.log("Using strategy 2: Parse main HTML content");
          studentData.photoUrl = this.extractPhotoUrlFromHTML(
            profileData.HTML,
            studentData.id
          );
        }

        if (!studentData.photoUrl && studentData.id) {
          this.log("Using strategy 3: Construct direct URL from student ID");

          if (profileData.HTML) {
            const photoPathMatch = profileData.HTML.match(
              new RegExp(`/${studentData.id}/Your_Photo/([^"'\\s]+)`)
            );
            if (photoPathMatch && photoPathMatch[1]) {
              this.log("Found direct file path in HTML");
              studentData.photoUrl = `${this.baseUrl}/srm_university/academia-academic-services/report/Student_Profile_Report/${studentData.id}/Your_Photo/${photoPathMatch[1]}`;
            }
          }

          if (!studentData.photoUrl) {
            studentData.photoUrl = this.constructDirectPhotoUrl(studentData.id);
          }
        }
      } else if (profileData.HTML) {
        const $ = cheerio.load(profileData.HTML);

        const idMatch = profileData.HTML.match(
          /Student_Profile_Report\/(\d+)\/Your_Photo/
        );
        if (idMatch && idMatch[1]) {
          studentData.id = idMatch[1];
        }

        studentData.photoUrl = this.extractPhotoUrlFromHTML(
          profileData.HTML,
          studentData.id
        );

        studentData.regNumber = this.extractRegNumber(profileData.HTML) || "";

        $("table").each((_, table) => {
          $(table)
            .find("tr")
            .each((_, row) => {
              const cells = $(row).find("td");
              if (cells.length >= 2) {
                const label = $(cells[0])
                  .text()
                  .trim()
                  .toLowerCase()
                  .replace(/:/g, "")
                  .replace(/\s+/g, "_");
                const value = $(cells[1]).text().trim();
                if (label && value) studentData[label] = value;
              }
            });
        });
      }

      if (studentData.photoUrl) {
        this.log(`Found photo URL: ${studentData.photoUrl}`);
        try {
          const photoData = await this.getDirectPhotoBase64(
            studentData.photoUrl
          );
          if (photoData) {
            studentData.photoBase64 = photoData.dataUrl;
            this.log("Successfully converted photo to base64");
          }
        } catch (error) {
          console.error(`Failed to get base64 image: ${error.message}`);
        }
      } else {
        this.log("No photo URL found for this user");
      }

      return {
        ...studentData,
        status: 200,
      };
    } catch (error) {
      console.error(`Profile extraction error: ${error.message}`);
      return {
        id: "",
        name: "",
        photoUrl: null,
        photoBase64: null,
        regNumber: "",
        status: 500,
        error: error.message,
      };
    }
  }

  async getDirectPhotoBase64(url) {
    if (!url) {
      console.warn("No photo URL provided to getDirectPhotoBase64");
      return null;
    }

    try {
      const imageResponse = await axios({
        method: "GET",
        url: url,
        headers: {
          Referer: `${this.baseUrl}/srm_university/academia-academic-services/report/Student_Profile_Report`,
          cookie: extractCookies(this.cookie),
        },
        responseType: "arraybuffer",
        validateStatus: (status) => status < 400,
        timeout: 10000,
      });

      if (!imageResponse.data || imageResponse.data.length === 0) {
        console.warn("Empty image data received");
        return null;
      }

      const base64 = Buffer.from(imageResponse.data, "binary").toString(
        "base64"
      );
      const contentType = imageResponse.headers["content-type"] || "image/jpeg";
      return {
        dataUrl: `data:${contentType};base64,${base64}`,
        contentType,
        base64,
      };
    } catch (error) {
      console.error(`Photo fetch error: ${error.message}`);
      return null;
    }
  }
}

module.exports = ProfileFetcher;
