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
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error ?? 'The request could not be completed.')
  return payload
}