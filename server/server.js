const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const compression = require("compression");
const { limiter } = require("./middleware/rateLimiter");
const { loggingMiddleware, logger } = require("./middleware/loggingMiddleware");
const routes = require("./routes");
const { register, metricsMiddleware } = require("./logging/prometheus-metrics");

if (process.env.DEV_MODE === "true") {
  dotenv.config();
}

const app = express();
const port = process.env.PORT || 9000;

app.use(loggingMiddleware);

app.use(metricsMiddleware);

app.use(bodyParser.json({ limit: "256kb" }));

app.use(compression());

app.use((req, res, next) => {
  res.set("Cache-Control", "public, max-age=300");
  next();
});

app.set("etag", true);

const urls = process.env.URL;
let allowedOrigins = ["http://localhost:5173"];
if (urls) {
  allowedOrigins = allowedOrigins.concat(urls.split(","));
}

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "Content-Type",
      "Accept",
      "X-CSRF-Token",
      "Authorization",
    ],
    exposedHeaders: ["Content-Length"],
    credentials: true,
    maxAge: 3600,
  })
);

app.use(limiter);

app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (ex) {
    res.status(500).end(ex.toString());
  }
});

app.use("/", routes);

app.use((err, req, res, next) => {
  logger.error("Server error", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error: true,
    message: "Internal server error",
    details: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

app.listen(port, "0.0.0.0", () => {
  logger.info(`Server running on port ${port}`);
});
