const express = require("express");
const { adminOnly, protect } = require("../middlewares/authMiddleware");
const { getUsers, getUserById, deleteUserFromTasksOnly } = require("../controllers/userController");

const router = express.Router();

router.get("/", protect, adminOnly, getUsers);
router.get("/:id", protect, getUserById);
router.delete("/:id", protect, adminOnly, deleteUserFromTasksOnly);


module.exports = router;