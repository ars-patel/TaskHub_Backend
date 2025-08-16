// controllers/authController.js
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// POST /api/auth/register
const registerUser = async (req, res) => {
  try {
    const { name, email, password, profileImageUrl, adminInviteToken } =
      req.body;

    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ message: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let role = "member";
    let adminId = null;
    let adminTokenToReturn = null;

    if (!adminInviteToken) {
      // Create an ADMIN with a unique token
      role = "admin";
      const user = await User.create({
        name,
        email,
        password: hashedPassword,
        profileImageUrl,
        role,
        // adminInviteToken will be auto-generated in pre-save if missing
      });
      adminTokenToReturn = user.adminInviteToken; // available after save

      return res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        adminInviteToken: adminTokenToReturn,
        profileImageUrl: user.profileImageUrl,
        token: generateToken(user),
      });
    } else {
      // Join as MEMBER to the specified admin
      const admin = await User.findOne({ role: "admin", adminInviteToken });
      if (!admin) {
        return res.status(400).json({ message: "Invalid invite token" });
      }
      adminId = admin._id;

      const user = await User.create({
        name,
        email,
        password: hashedPassword,
        profileImageUrl,
        role, // "member"
        adminId, // link to admin
      });

      return res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        adminId: user.adminId,
        profileImageUrl: user.profileImageUrl,
        token: generateToken(user),
      });
    }
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// POST /api/auth/login — include token/admin info in response
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid email or password" });

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      adminId: user.adminId || null,
      adminInviteToken:
        user.role === "admin" ? user.adminInviteToken : undefined,
      profileImageUrl: user.profileImageUrl,
      token: generateToken(user),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update basic details
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    if (req.file) {
      // Use multer uploaded file
      user.profileImageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    } else {
      // Fallback if no file uploaded
      user.profileImageUrl = req.body.profileImageUrl || user.profileImageUrl;
    }

    // Update password (with old password check for security)
    if (req.body.password) {
      if (!req.body.oldPassword) {
        return res
          .status(400)
          .json({ message: "Old password is required to change password" });
      }

      const isOldMatch = await bcrypt.compare(
        req.body.oldPassword,
        user.password
      );
      if (!isOldMatch) {
        return res.status(401).json({ message: "Old password is incorrect" });
      }

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(req.body.password, salt);
    }

    const updatedUser = await user.save();

    res.status(200).json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      profileImageUrl: updatedUser.profileImageUrl,
      token: generateToken(updatedUser),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = { registerUser, loginUser, getUserProfile, updateUserProfile };
