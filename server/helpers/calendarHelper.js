const axios = require("axios");
const cheerio = require("cheerio");
const {
  extractCookies,
  convertHexToHTML,
  decodeHTMLEntities,
} = require("../utils/extractUtils");
const {
  Day,
  CalendarMonth,
  CalendarResponse,
  DayOrderResponse,
} = require("../types/calendar");

class CalendarFetcher {
  constructor(date, cookie) {
    this.cookie = cookie;
    this.date = date || new Date();
  }

  async getHTML() {
    const response = await axios({
      method: "GET",
      url: "https://academia.srmist.edu.in/srm_university/academia-academic-services/page/Academic_Planner_2024_25_EVEN",
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        cookie: `ZCNEWUIPUBLICPORTAL=true; cli_rgn=IN; ${extractCookies(
          this.cookie
        )}`,
        Referer: "https://academia.srmist.edu.in/",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=7200",
      },
    });

    const data = response.data;
    if (data.includes("<table bgcolor=")) {
      return data;
    }
    const parts = data.split('zmlvalue="');
    if (parts.length < 2) throw new Error("Invalid HTML format");
    const decodedHTML = convertHexToHTML(parts[1].split('" > </div> </div>')[0]);
    return decodeHTMLEntities(decodedHTML);
  }

  async getCalendar() {
    try {
      const html = await this.getHTML();
      return this.parseCalendar(html);
    } catch (error) {
      return {
        ...new CalendarResponse(),
        error: true,
        message: error.message,
        status: 500,
      };
    }
  }

  parseCalendar(html) {
    const $ = cheerio.load(html);
    const response = new CalendarResponse();

    // Extract month headers
    const monthHeaders = [];
    $("th").each((_, el) => {
      const month = $(el).text().trim();
      if (month.includes("'2")) monthHeaders.push(month);
    });

    // Prepare data structure
    const data = monthHeaders.map((header) => ({
      month: header,
      days: [],
    }));

    // Parse table rows efficiently
    $("table tr").each((_, row) => {
      const tds = [];
      $(row)
        .find("td")
        .each((__, td) => tds.push($(td).text().trim()));
      for (let i = 0; i < monthHeaders.length; i++) {
        const pad = i * 5;
        const date = tds[pad];
        const day = tds[pad + 1];
        const event = tds[pad + 2];
        const dayOrder = tds[pad + 3];
        if (date && dayOrder) {
          data[i].days.push({
            date,
            day,
            event,
            dayOrder,
          });
        }
      }
    });

    // Sort months and days
    this.sortCalendarData(data);

    // Find current month and today/tomorrow
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const currentMonthName = monthNames[this.date.getMonth()];
    let monthIndex = data.findIndex(m => m.month.includes(currentMonthName));
    if (monthIndex === -1) monthIndex = 0;
    const monthEntry = data[monthIndex];

    let today = null, tomorrow = null, dayAfterTomorrow = null;
    if (monthEntry && monthEntry.days.length > 0) {
      const todayIndex = this.date.getDate() - 1;
      today = monthEntry.days[todayIndex] || null;
      tomorrow = monthEntry.days[todayIndex + 1] || (data[monthIndex + 1]?.days[0] || null);
      dayAfterTomorrow =
        monthEntry.days[todayIndex + 2] ||
        (data[monthIndex + 1]?.days[1] ||
          data[monthIndex + 2]?.days[0] ||
          null);
    }

    response.today = today;
    response.tomorrow = tomorrow;
    response.dayAfterTomorrow = dayAfterTomorrow;
    response.index = monthIndex;
    response.calendar = data;
    response.status = 200;
    return response;
  }

  async getTodayDayOrder() {
    try {
      const calendarResp = await this.getCalendar();
      if (calendarResp.error) {
        return {
          ...new DayOrderResponse(),
          error: true,
          message: calendarResp.message,
          status: calendarResp.status,
        };
      }
      if (!calendarResp.today) {
        return {
          ...new DayOrderResponse(),
          error: true,
          message: "No information available for today",
          status: 404,
        };
      }
      return {
        ...new DayOrderResponse(),
        date: calendarResp.today.date,
        day: calendarResp.today.day,
        dayOrder: calendarResp.today.dayOrder,
        event: calendarResp.today.event,
      };
    } catch (error) {
      return {
        ...new DayOrderResponse(),
        error: true,
        message: error.message,
        status: 500,
      };
    }
  }

  sortCalendarData(data) {
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const monthIndices = Object.fromEntries(monthNames.map((m, i) => [m, i]));
    data.sort((a, b) => {
      const m1 = a.month.split("'")[0].substring(0, 3);
      const m2 = b.month.split("'")[0].substring(0, 3);
      return monthIndices[m1] - monthIndices[m2];
    });
    data.forEach(monthData => {
      monthData.days.sort((a, b) => parseInt(a.date, 10) - parseInt(b.date, 10));
    });
  }
}

module.exports = CalendarFetcher;