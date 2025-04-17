const ProfileFetcher = require("../helpers/profileHelper");

async function getProfile(token) {
  const profileFetcher = new ProfileFetcher(token);
  return profileFetcher.getProfile();
}

module.exports = { getProfile };