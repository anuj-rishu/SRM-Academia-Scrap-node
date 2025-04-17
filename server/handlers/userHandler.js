const { getUserWithPhoto } = require("../helpers/userHelper");

async function getUser(token) {
  return getUserWithPhoto(token);
}

module.exports = { getUser };