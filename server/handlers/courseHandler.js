const CourseFetcher = require('../helpers/courseHelper');

async function getCourses(token) {
  const fetcher = new CourseFetcher(token);
  return fetcher.getCourses();
}

module.exports = { getCourses };