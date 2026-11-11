import mongoose from 'mongoose'
import { Conversation } from '../models/Conversation.js'

export async function getAuthorizedConversation(conversationId, userId) {
  if (!mongoose.isValidObjectId(conversationId)) return null
  return Conversation.findOne({ _id: conversationId, participants: userId })
}

export function conversationChannel(conversationId) {
  return `privatechat:conversation:${conversationId}`
}