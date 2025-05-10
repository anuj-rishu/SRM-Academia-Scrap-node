const promClient = require("prom-client");

const register = new promClient.Registry();

promClient.collectDefaultMetrics({ register });

const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: "http_request_duration_ms",
  help: "Duration of HTTP requests in ms",
  labelNames: ["method", "route", "status_code", "path"],
  buckets: [10, 50, 100, 200, 300, 400, 500, 750, 1000, 2000, 5000],
});
register.registerMetric(httpRequestDurationMicroseconds);

const httpRequestCounter = new promClient.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "code", "path"],
});
register.registerMetric(httpRequestCounter);

const routeErrorCounter = new promClient.Counter({
  name: "http_request_errors_total",
  help: "Total number of HTTP request errors",
  labelNames: ["method", "route", "code", "error_type", "path"],
});
register.registerMetric(routeErrorCounter);

const routeHandlerDuration = new promClient.Histogram({
  name: "api_handler_duration_ms",
  help: "Duration of API handler execution in ms",
  labelNames: ["handler", "success"],
  buckets: [10, 50, 100, 200, 300, 400, 500, 750, 1000, 2000, 5000],
});
register.registerMetric(routeHandlerDuration);

const metricsMiddleware = (req, res, next) => {
  if (req.path === "/metrics") {
    return next();
  }

  const end = httpRequestDurationMicroseconds.startTimer();

  const getRoutePath = () => {
    let path = req.originalUrl || req.url;

    if (path.includes("?")) {
      path = path.split("?")[0];
    }

    path = path.replace(/\/\d+/g, "/:id");

    return path;
  };

  const getHandlerName = () => {
    const path = getRoutePath();

    return path.replace(/^\/|\/$/g, "").replace(/\//g, "_") || "root";
  };

  const routePath = getRoutePath();
  const handlerName = getHandlerName();

  req.routeMetrics = {
    path: routePath,
    handler: handlerName,
    startTime: Date.now(),
  };

  res.on("finish", () => {
    const responseTime = Date.now() - req.routeMetrics.startTime;

    let route = routePath;

    if (req.route && req.route.path) {
      route = req.route.path;
    }

    end({
      method: req.method,
      route: route,
      status_code: res.statusCode,
      path: routePath,
    });

    httpRequestCounter.inc({
      method: req.method,
      route: route,
      code: res.statusCode,
      path: routePath,
    });

    if (res.statusCode >= 400) {
      routeErrorCounter.inc({
        method: req.method,
        route: route,
        code: res.statusCode,
        error_type: res.statusCode >= 500 ? "server_error" : "client_error",
        path: routePath,
      });
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(
        `${req.method} ${routePath} - ${res.statusCode} - ${responseTime}ms`
      );
    }
  });

  next();
};

const timeHandler = (handlerName) => {
  return (fn) => {
    return async (...args) => {
      const timer = routeHandlerDuration.startTimer();
      try {
        const result = await fn(...args);
        timer({ handler: handlerName, success: "true" });
        return result;
      } catch (error) {
        timer({ handler: handlerName, success: "false" });
        throw error;
      }
    };
  };
};

module.exports = {
  register,
  metricsMiddleware,
  timeHandler,
  httpRequestCounter,
  routeErrorCounter,
  routeHandlerDuration,
};
