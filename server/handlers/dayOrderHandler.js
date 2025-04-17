const CalendarFetcher = require('../helpers/calendarHelper');

async function getTodayDayOrder(token) {
  const scraper = new CalendarFetcher(new Date(), token);
  return scraper.getTodayDayOrder();
}

async function getTomorrowDayOrder(token) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const scraper = new CalendarFetcher(tomorrow, token);
  return scraper.getTodayDayOrder();
}

async function getDayAfterTomorrowDayOrder(token) {
  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);
  const scraper = new CalendarFetcher(dayAfter, token);
  return scraper.getTodayDayOrder();
}

module.exports = { 
  getTodayDayOrder,
  getTomorrowDayOrder,
  getDayAfterTomorrowDayOrder
};