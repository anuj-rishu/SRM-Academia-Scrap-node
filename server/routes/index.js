const express = require("express");
const authRoutes = require("./authRoutes");
const classRoutes = require("./classRoutes");
const academicRoutes = require("./academicRoutes");
const userRoutes = require("./userRoutes");
const combinedRoutes = require("./combinedRoutes");

const router = express.Router();

router.get("/hello", (req, res) => {
  res.json({ message: "Hello, World!" });
});

router.use(authRoutes);
router.use(classRoutes);
router.use(academicRoutes);
router.use(userRoutes);
router.use(combinedRoutes);

module.exports = router;