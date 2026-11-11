import { User } from '../models/User.js'

export async function requireUser(request, response, next) {
  if (!request.session?.userId) return response.status(401).json({ error: 'Authentication required.' })
  const user = await User.findById(request.session.userId)
  if (!user || user.accountStatus !== 'active' || request.session.authVersion !== user.authVersion) {
    request.session.destroy(() => {})
    return response.status(401).json({ error: 'Authentication required.' })
  }
  request.user = user
  return next()
}