const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const compression = require("compression");
const { limiter } = require("./middleware/rateLimiter");
const routes = require("./routes");

if (process.env.DEV_MODE === "true") {
  dotenv.config();
}

const app = express();
const port = process.env.PORT || 9000;

app.use(bodyParser.json({ limit: "256kb" }));

app.use(compression());

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

app.use("/", routes);

app.listen(port, "0.0.0.0", () => {
  if (process.env.NODE_ENV !== "production") {
    console.log(`Server running on port ${port}`);
  }
});
