const winston = require("winston");

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(
    ({ level, message, timestamp, stack }) =>
      `${timestamp} ${level}: ${message} ${stack ? "\n" + stack : ""}`
  )
);

const logger = winston.createLogger({
  level: "error",
  format: consoleFormat,
  defaultMeta: { service: "srm-scrap-api" },
  transports: [new winston.transports.Console()],
});

module.exports = logger;
