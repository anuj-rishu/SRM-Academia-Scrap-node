const fs = require("fs");
const path = require("path");
const { createLogger, format, transports } = require("winston");
const { combine, timestamp, printf, colorize, json } = format;

const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = createLogger({
  level: "info",
  format: combine(
    timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    json()
  ),
  defaultMeta: { service: "srm-academia-api" },
  transports: [
    new transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
    }),
    new transports.File({
      filename: path.join(logsDir, "combined.log"),
    }),
    new transports.File({
      filename: path.join(logsDir, "access.log"),
      level: "http",
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new transports.Console({
      format: combine(
        colorize(),
        printf(({ level, message, timestamp, ...metadata }) => {
          return `${timestamp} ${level}: ${message} ${
            Object.keys(metadata).length
              ? JSON.stringify(metadata, null, 2)
              : ""
          }`;
        })
      ),
    })
  );
}

const loggingMiddleware = (req, res, next) => {
  const originalSend = res.send;

  const startTime = Date.now();

  const requestId =
    Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

  req.requestId = requestId;

  let responseBody = "";

  res.send = function (body) {
    responseBody = body;
    originalSend.apply(res, arguments);
    return res;
  };

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const routePath = req.originalUrl || req.url;
    const method = req.method;
    const statusCode = res.statusCode;
    const userAgent = req.get("user-agent") || "";
    const contentLength = res.get("content-length") || 0;

    const path = routePath.split("?")[0];

    const logEntry = {
      requestId,
      method,
      path,
      statusCode,
      duration,
      userAgent,
      contentLength,
      route: req.route?.path || path,
      level: statusCode >= 400 ? "error" : "http",
    };

    if (method !== "GET" && req.body) {
      const sanitizedBody = { ...req.body };

      if (sanitizedBody.password) sanitizedBody.password = "[REDACTED]";
      if (sanitizedBody.token) sanitizedBody.token = "[REDACTED]";
      if (sanitizedBody.csrfToken) sanitizedBody.csrfToken = "[REDACTED]";

      logEntry.requestBody = sanitizedBody;
    }

    if (Object.keys(req.query).length > 0) {
      logEntry.query = req.query;
    }

    if (statusCode >= 400) {
      try {
        const parsedBody = JSON.parse(responseBody);
        if (parsedBody.error || parsedBody.message) {
          logEntry.errorDetails = {
            message: parsedBody.message || parsedBody.error,
            ...(parsedBody.details ? { details: parsedBody.details } : {}),
          };
        } else {
          logEntry.responseBody = parsedBody;
        }
      } catch (e) {
        if (responseBody && typeof responseBody === "string") {
          logEntry.responseText = responseBody.substring(0, 500);
          if (responseBody.length > 500)
            logEntry.responseText += "... [truncated]";
        }
      }
    }

    if (statusCode >= 500) {
      logger.error(`${method} ${path} ${statusCode}`, logEntry);
    } else if (statusCode >= 400) {
      logger.warn(`${method} ${path} ${statusCode}`, logEntry);
    } else {
      logger.http(`${method} ${path} ${statusCode}`, logEntry);
    }
  });

  next();
};

module.exports = { loggingMiddleware, logger };
