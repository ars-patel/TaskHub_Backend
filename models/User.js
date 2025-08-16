// models/User.js
const mongoose = require("mongoose");
const crypto = require("crypto");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profileImageUrl: { type: String, default: null },
    role: { type: String, enum: ["admin", "member"], default: "member" },

    // NEW: per-admin invite token (only for admins)
    adminInviteToken: { type: String, unique: true, sparse: true },

    // NEW: link member -> admin
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// Auto-generate a token for admins if missing
UserSchema.pre("save", function (next) {
  if (this.role === "admin" && !this.adminInviteToken) {
    this.adminInviteToken = crypto.randomBytes(12).toString("hex"); // 24 chars
  }
  next();
});

module.exports = mongoose.model("User", UserSchema);