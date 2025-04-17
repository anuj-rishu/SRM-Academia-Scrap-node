const cache = new Map();

const cacheMiddleware = (req, res, next) => {
  if (req.method !== "GET") return next();

  const key = req.path + "_" + req.headers["x-csrf-token"];
  const cachedBody = cache.get(key);

  if (cachedBody) {
    return res.json(cachedBody);
  }

  const originalJson = res.json;
  res.json = function (body) {
    cache.set(key, body);
    setTimeout(() => cache.delete(key), 2 * 60 * 1000);
    return originalJson.call(this, body);
  };

  next();
};

module.exports = { cacheMiddleware };