import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true, sparse: true, match: /^PC\d{4}$/ },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3, maxlength: 24 },
  fullName: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  profilePicture: { type: String, default: '', maxlength: 500 },
  emailVerified: { type: Boolean, default: true },
  verificationTokenHash: { type: String, select: false },
  verificationExpiresAt: Date,
  resetTokenHash: { type: String, select: false },
  resetExpiresAt: Date,
  accountStatus: { type: String, enum: ['pending', 'active', 'disabled'], default: 'pending' },
  authVersion: { type: Number, default: 0 },
  loginFailures: { type: Number, default: 0, select: false },
  lockedUntil: { type: Date, select: false },
  lastSeen: { type: Date, default: null },
}, { timestamps: true, versionKey: false })

export const User = mongoose.models.User ?? mongoose.model('User', userSchema)