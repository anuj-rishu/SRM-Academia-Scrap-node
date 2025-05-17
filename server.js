const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/userRoutes");
const attendanceRoutes = require("./routes/academicRoute");
const errorHandler = require("./middleware/errorHandler");

const logger = require("./utils/logger");

const app = express();
const PORT = process.env.PORT || 9000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/api", authRoutes);
app.use("/api", profileRoutes);
app.use("/api", attendanceRoutes);

app.get("/api/ping", (req, res) => {
  res.status(200).json({ status: true, message: "Service operational" });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on("uncaughtException", (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});

module.exports = app;
