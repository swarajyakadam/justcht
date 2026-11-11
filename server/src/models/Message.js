import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  encryptedPayload: { type: String, required: true, maxlength: 100_000 },
  encryptionMetadata: { type: mongoose.Schema.Types.Mixed, required: true },
  messageType: { type: String, enum: ['text', 'image', 'document'], default: 'text' },
  clientMessageId: { type: String, required: true, maxlength: 100 },
  deliveryStatus: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  deletedForEveryone: { type: Boolean, default: false },
}, { timestamps: { createdAt: 'messageTimestamp', updatedAt: false }, versionKey: false })

messageSchema.index({ conversationId: 1, messageTimestamp: -1 })
messageSchema.index({ conversationId: 1, senderId: 1, clientMessageId: 1 }, { unique: true })

export const Message = mongoose.models.Message ?? mongoose.model('Message', messageSchema)