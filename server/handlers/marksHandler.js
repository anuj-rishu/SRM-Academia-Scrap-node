const MarksFetcher = require('../helpers/marksHelper');

async function getMarks(token) {
  const marksFetcher = new MarksFetcher(token);
  return marksFetcher.getMarks();
}

module.exports = { getMarks };