import mongoose from 'mongoose'

const userKeySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  publicKey: { type: String, required: true, maxlength: 200 }, // base64 SPKI P-256 (~124 chars)
}, { timestamps: true, versionKey: false })

export const UserKey = mongoose.models.UserKey ?? mongoose.model('UserKey', userKeySchema)
