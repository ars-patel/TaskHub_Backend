const express = require("express");
const {
  getCommentsByTaskId,
  addComment,
  editComment,
  deleteComment,
  deleteAllCommentsForTask,
  addReaction,
} = require("../controllers/commentController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

// GET all comments for a task
router.get("/:taskId/comments", protect, getCommentsByTaskId);

// ADD comment to a task
router.post("/:taskId/comments", protect, addComment);

// EDIT comment
router.put("/:taskId/comments/:commentId", protect, editComment);

// DELETE single comment
router.delete("/:taskId/comments/:commentId", protect, deleteComment);

// DELETE all comments for a task
router.delete("/:taskId/comments", protect, deleteAllCommentsForTask);

// ADD reaction to a comment
router.post("/:taskId/comments/:commentId/reactions", protect, addReaction);

module.exports = router;
