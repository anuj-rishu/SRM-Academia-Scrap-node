const CalendarFetcher = require("../helpers/calendarHelper");

async function getCalendar(token) {
  const scraper = new CalendarFetcher(new Date(), token);
  return scraper.getCalendar();
}

module.exports = { getCalendar };