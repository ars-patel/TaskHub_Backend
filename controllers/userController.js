const Task = require("../models/Task");
const User = require("../models/User");

const getUsers = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Only members under this admin
    const users = await User.find({
      role: "member",
      adminId: req.user._id,
    }).select("-password");

    const usersWithTaskCounts = await Promise.all(
      users.map(async (user) => {
        const [pendingTasks, inProgressTasks, completedTasks] =
          await Promise.all([
            Task.countDocuments({
              admin: req.user._id,
              assignedTo: user._id,
              status: "Pending",
            }),
            Task.countDocuments({
              admin: req.user._id,
              assignedTo: user._id,
              status: "In Progress",
            }),
            Task.countDocuments({
              admin: req.user._id,
              assignedTo: user._id,
              status: "Completed",
            }),
          ]);
        return { ...user._doc, pendingTasks, inProgressTasks, completedTasks };
      })
    );

    res.json(usersWithTaskCounts);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
// const deleteUser = async (req, res) => {
//   try {
//   } catch (error) {
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };

const deleteUserFromTasksOnly = async (req, res) => {
  try {
    const userId = req.params.id;

    // Find tasks under this admin where this user is assigned
    const tasks = await Task.find({ assignedTo: userId, admin: req.user._id });

    for (const task of tasks) {
      if (task.assignedTo.length > 1) {
        // Multiple users → remove only this user
        task.assignedTo = task.assignedTo.filter(
          (id) => id.toString() !== userId
        );
        await task.save();
      } else {
        // Only this user → clear assignedTo but keep task
        task.assignedTo = [];
        await task.save();
      }
    }

    // Remove user from admin's member list
    await User.findByIdAndDelete(userId);

    res.json({
      message:
        "User removed and tasks updated. Tasks without members remain unassigned.",
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = { getUsers, getUserById, deleteUserFromTasksOnly };
