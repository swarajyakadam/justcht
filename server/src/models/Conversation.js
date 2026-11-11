import mongoose from 'mongoose'

const conversationSchema = new mongoose.Schema({
  participants: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], required: true, validate: [(ids) => ids.length === 2, 'Personal conversations have two participants.'] },
  pairKey: { type: String, required: true, unique: true },
  conversationType: { type: String, enum: ['personal'], default: 'personal' },
  lastMessageAt: Date,
}, { timestamps: true, versionKey: false })

conversationSchema.index({ participants: 1, updatedAt: -1 })

export const Conversation = mongoose.models.Conversation ?? mongoose.model('Conversation', conversationSchema)