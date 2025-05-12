const FeedbackFetch = require("../helpers/feedbackHelper");

async function getFeedbackForm(token) {
  const scraper = new FeedbackFetch(token);
  return scraper.getFormData();
}

module.exports = { getFeedbackForm };