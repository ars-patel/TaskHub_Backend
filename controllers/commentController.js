const Comment = require("../models/Comment");
const Task = require("../models/Task");

// =====================
// COMMENTS CONTROLLERS
// =====================

// GET /api/tasks/:taskId/comments
const getCommentsByTaskId = async (req, res) => {
  try {
    const { taskId } = req.params;
    const comments = await Comment.find({ task: taskId })
      .populate("author", "name profileImageUrl")
      .populate("reactions.user", "name profileImageUrl")
      .sort({ createdAt: -1 });
    res.status(200).json(comments);
  } catch (error) {
    console.error("Get comments error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// POST /api/tasks/:taskId/comments
const addComment = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { text } = req.body;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const comment = await Comment.create({
      text,
      task: taskId,
      author: req.user._id,
    });

    const populated = await comment.populate("author", "name profileImageUrl");
    res.status(201).json(populated);
  } catch (error) {
    console.error("Add comment error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// PUT /api/tasks/:taskId/comments/:commentId
const editComment = async (req, res) => {
  try {
    const { taskId, commentId } = req.params;
    const { text } = req.body;

    const comment = await Comment.findById(commentId).populate(
      "author",
      "name profileImageUrl"
    );
    if (!comment) return res.status(404).json({ message: "Comment not found" });
    if (comment.task.toString() !== taskId)
      return res.status(400).json({ message: "Comment does not belong to this task" });
    if (comment.author._id.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not authorized to edit this comment" });

    comment.text = text;
    comment.isEdited = true;
    await comment.save();

    res.status(200).json(comment);
  } catch (error) {
    console.error("Edit comment error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// DELETE /api/tasks/:taskId/comments/:commentId
const deleteComment = async (req, res) => {
  try {
    const { taskId, commentId } = req.params;

    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });
    if (comment.task.toString() !== taskId)
      return res.status(400).json({ message: "Comment does not belong to this task" });
    if (comment.author.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not authorized to delete this comment" });

    await comment.deleteOne();
    res.status(200).json({ message: "Comment deleted successfully" });
  } catch (error) {
    console.error("Delete comment error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// DELETE /api/tasks/:taskId/comments
const deleteAllCommentsForTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    if (task.admin.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Only the task admin can delete all comments" });

    const result = await Comment.deleteMany({ task: taskId });

    res.status(200).json({
      message: `Deleted ${result.deletedCount} comments successfully`,
    });
  } catch (error) {
    console.error("Delete all comments error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// POST /api/tasks/:taskId/comments/:commentId/reactions
const addReaction = async (req, res) => {
  try {
    const { taskId, commentId } = req.params;
    const { emoji } = req.body;

    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });
    if (comment.task.toString() !== taskId)
      return res.status(400).json({ message: "Comment does not belong to this task" });

    // Toggle reaction: add if doesn't exist, remove if exists
    const existing = comment.reactions.find(
      (r) => r.user.toString() === req.user._id.toString() && r.emoji === emoji
    );
    if (existing) {
      comment.reactions = comment.reactions.filter(
        (r) => !(r.user.toString() === req.user._id.toString() && r.emoji === emoji)
      );
    } else {
      comment.reactions.push({ emoji, user: req.user._id });
    }

    await comment.save();
    const populated = await comment.populate("reactions.user", "name profileImageUrl");
    res.status(200).json(populated);
  } catch (error) {
    console.error("Add reaction error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  getCommentsByTaskId,
  addComment,
  editComment,
  deleteComment,
  deleteAllCommentsForTask,
  addReaction,
};