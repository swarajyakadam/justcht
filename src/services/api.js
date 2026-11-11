export async function api(path, options = {}) {
  const headers = new Headers(options.headers ?? {})
  if (options.body !== undefined) headers.set('content-type', 'application/json')
  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  if (response.status === 204) return null
  const isJson = response.headers.get('content-type')?.includes('application/json')
  const payload = isJson ? await response.json().catch(() => ({})) : {}
  if (!response.ok) {
    if (response.status === 429) throw new Error(payload.error ?? 'Too many attempts. Wait a few minutes and try again.')
    if (response.status >= 500) throw new Error(payload.error ?? 'The service is temporarily unavailable. Please try again.')
    throw new Error(payload.error ?? 'The request could not be completed.')
  }
  return payload
}