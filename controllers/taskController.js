const Task = require("../models/Task");

const getTasks = async (req, res) => {
  try {
    const { status } = req.query;

    // Base filter based on role
    const base = {
      admin: req.user.role === "admin" ? req.user._id : req.user.adminId,
    };
    if (status && status !== "All") {
      base.status = status;
    }

    // Query with sorting by dueDate (ascending)
    let query = req.user.role === "admin"
      ? Task.find(base)
      : Task.find({ ...base, assignedTo: req.user._id });

    let tasks = await query
      .populate("assignedTo", "name email profileImageUrl")
      .sort({ dueDate: 1 }); // Sort by dueDate

    // Add completedTodoCount to each task (processed in-memory)
    tasks = tasks.map((task) => ({
      ...task._doc,
      completedTodoCount: task.todoChecklist.filter((i) => i.completed).length,
    }));

    // Count tasks by status
    const countFilter = req.user.role === "admin"
      ? base
      : { ...base, assignedTo: req.user._id };

    const [allTasks, pendingTasks, inProgressTasks, completedTasks] = await Promise.all([
      Task.countDocuments(countFilter),
      Task.countDocuments({ ...countFilter, status: "Pending" }),
      Task.countDocuments({ ...countFilter, status: "In Progress" }),
      Task.countDocuments({ ...countFilter, status: "Completed" }),
    ]);

    res.json({
      tasks,
      statusSummary: { all: allTasks, pendingTasks, inProgressTasks, completedTasks },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// GET /api/tasks/:id
const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate(
      "assignedTo",
      "name email profileImageUrl"
    );
    if (!task) return res.status(404).json({ message: "Task not found" });

    const tenantId = req.user.role === "admin" ? req.user._id.toString() : req.user.adminId?.toString();
    if (!tenantId || task.admin.toString() !== tenantId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// POST /api/tasks
const createTask = async (req, res) => {
  try {
    const { title, description, priority, dueDate, assignedTo, attachments, todoChecklist } = req.body;
    if (!Array.isArray(assignedTo)) {
      return res.status(400).json({ message: "assignedTo must be an array of user IDs" });
    }

    const adminOwner = req.user.role === "admin" ? req.user._id : req.user.adminId;

    const task = await Task.create({
      title,
      description,
      priority,
      dueDate,
      assignedTo,
      createdBy: req.user._id,
      admin: adminOwner,
      todoChecklist,
      attachments,
    });

    res.status(200).json({ message: "Task created successfully", task });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// PUT /api/tasks/:id
const updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const tenantId = req.user.role === "admin" ? req.user._id.toString() : req.user.adminId?.toString();
    if (task.admin.toString() !== tenantId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    task.title = req.body.title || task.title;
    task.description = req.body.description || task.description;
    task.priority = req.body.priority || task.priority;
    task.dueDate = req.body.dueDate || task.dueDate;
    task.todoChecklist = req.body.todoChecklist || task.todoChecklist;
    task.attachments = req.body.attachments || task.attachments;

    if (req.body.assignedTo) {
      if (!Array.isArray(req.body.assignedTo)) {
        return res.status(400).json({ message: "assignedTo must be an array of user IDs" });
      }
      task.assignedTo = req.body.assignedTo;
    }

    const updatedTask = await task.save();
    res.json({ message: "Task updated successfully", updatedTask });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// DELETE /api/tasks/:id
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const tenantId = req.user.role === "admin" ? req.user._id.toString() : req.user.adminId?.toString();
    if (task.admin.toString() !== tenantId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await task.deleteOne();
    res.status(200).json({ message: "Task deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// PATCH /api/tasks/:id/status
const updateTaskStatus = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const tenantId = req.user.role === "admin" ? req.user._id.toString() : req.user.adminId?.toString();
    if (task.admin.toString() !== tenantId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const isAssigned = task.assignedTo.some(
      (userId) => userId.toString() === req.user._id.toString()
    );
    if (!isAssigned && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    task.status = req.body.status || task.status;
    if (task.status === "Completed") {
      task.todoChecklist.forEach((item) => (item.completed = true));
      task.progress = 100;
    }

    await task.save();
    res.json({ message: "Task status updated", task });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// PATCH /api/tasks/:id/checklist
const updateTaskChecklist = async (req, res) => {
  try {
    const { todoChecklist } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const tenantId = req.user.role === "admin" ? req.user._id.toString() : req.user.adminId?.toString();
    if (task.admin.toString() !== tenantId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (!task.assignedTo.includes(req.user._id) && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to update checklist" });
    }

    task.todoChecklist = todoChecklist;
    const completedCount = todoChecklist.filter((item) => item.completed).length;
    const totalItems = todoChecklist.length;
    task.progress = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

    if (task.progress === 100) task.status = "Completed";
    else if (task.progress > 0) task.status = "In Progress";
    else task.status = "Pending";

    await task.save();
    const updatedTask = await Task.findById(req.params.id).populate(
      "assignedTo",
      "name email profileImageUrl"
    );
    res.json({ message: "Task checklist updated", task: updatedTask });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// GET /api/dashboard/admin
const getDashboardData = async (req, res) => {
  try {
    const base = { admin: req.user._id };

    const totalTasks = await Task.countDocuments(base);
    const pendingTasks = await Task.countDocuments({ ...base, status: "Pending" });
    const completedTasks = await Task.countDocuments({ ...base, status: "Completed" });
    const overdueTasks = await Task.countDocuments({
      ...base,
      status: { $ne: "Completed" },
      dueDate: { $lt: new Date() },
    });

    const taskStatuses = ["Pending", "In Progress", "Completed"];
    const taskDistributionRaw = await Task.aggregate([
      { $match: base },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const taskDistribution = taskStatuses.reduce((acc, status) => {
      acc[status.replace(/\s+/g, "")] =
        taskDistributionRaw.find((i) => i._id === status)?.count || 0;
      return acc;
    }, {});
    taskDistribution.All = totalTasks;

    const taskPriorities = ["Low", "Medium", "High"];
    const taskPriorityLevelsRaw = await Task.aggregate([
      { $match: base },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]);
    const taskPriorityLevels = taskPriorities.reduce((acc, p) => {
      acc[p] = taskPriorityLevelsRaw.find((i) => i._id === p)?.count || 0;
      return acc;
    }, {});

    const recentTasks = await Task.find(base)
      .sort({ createdAt: -1 })
      .limit(10)
      .select("title status priority dueDate createdAt");

    res.status(200).json({
      statistics: { totalTasks, pendingTasks, completedTasks, overdueTasks },
      charts: { taskDistribution, taskPriorityLevels },
      recentTasks,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// GET /api/dashboard/member
const getUserDashboardData = async (req, res) => {
  try {
    const base = { admin: req.user.adminId, assignedTo: req.user._id };

    const totalTasks = await Task.countDocuments(base);
    const pendingTasks = await Task.countDocuments({ ...base, status: "Pending" });
    const completedTasks = await Task.countDocuments({ ...base, status: "Completed" });
    const overdueTasks = await Task.countDocuments({
      ...base,
      status: { $ne: "Completed" },
      dueDate: { $lt: new Date() },
    });

    const taskStatuses = ["Pending", "In Progress", "Completed"];
    const taskDistributionRaw = await Task.aggregate([
      { $match: base },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const taskDistribution = taskStatuses.reduce((acc, status) => {
      acc[status.replace(/\s+/g, "")] =
        taskDistributionRaw.find((i) => i._id === status)?.count || 0;
      return acc;
    }, {});
    taskDistribution.All = totalTasks;

    const taskPriorities = ["Low", "Medium", "High"];
    const taskPriorityLevelsRaw = await Task.aggregate([
      { $match: base },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]);
    const taskPriorityLevels = taskPriorities.reduce((acc, p) => {
      acc[p] = taskPriorityLevelsRaw.find((i) => i._id === p)?.count || 0;
      return acc;
    }, {});

    const recentTasks = await Task.find(base)
      .sort({ createdAt: -1 })
      .limit(10)
      .select("title status priority dueDate createdAt");

    res.status(200).json({
      statistics: { totalTasks, pendingTasks, completedTasks, overdueTasks },
      charts: { taskDistribution, taskPriorityLevels },
      recentTasks,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  updateTaskChecklist,
  getDashboardData,
  getUserDashboardData,
};