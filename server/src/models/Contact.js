import mongoose from 'mongoose'

const contactSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contactUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false })

contactSchema.index({ userId: 1, contactUserId: 1 }, { unique: true })

export const Contact = mongoose.models.Contact ?? mongoose.model('Contact', contactSchema)