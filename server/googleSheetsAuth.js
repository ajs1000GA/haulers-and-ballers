import { JWT } from 'google-auth-library'

const SHEETS_READONLY_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly'
const TOKEN_PATH = '/api/google-sheets-token'

let jwtClient
let jwtClientKey = ''

export function createSheetsTokenMiddleware(env = process.env) {
  return async function sheetsTokenMiddleware(req, res, next) {
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname !== TOKEN_PATH) {
      next()
      return
    }

    if (req.method !== 'GET') {
      writeJson(res, 405, { error: 'Method not allowed' })
      return
    }

    try {
      const credentials = getServiceAccountCredentials(env)
      if (!credentials) {
        writeJson(res, 503, {
          error:
            'Missing VITE_GOOGLE_SERVICE_ACCOUNT_EMAIL or VITE_GOOGLE_PRIVATE_KEY; using sample data.',
        })
        return
      }

      const token = await getGoogleSheetsAccessToken(credentials)
      writeJson(res, 200, token)
    } catch (error) {
      writeJson(res, 500, { error: error.message || 'Google Sheets auth failed.' })
    }
  }
}

export async function getGoogleSheetsAccessToken(credentials) {
  const client = getJwtClient(credentials)
  const tokenResponse = await client.getAccessToken()
  const accessToken = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token

  if (!accessToken) {
    throw new Error('Google service account JWT did not return an access token.')
  }

  return {
    accessToken,
    expiresAt: new Date(client.credentials.expiry_date || Date.now() + 50 * 60_000).toISOString(),
  }
}

function getJwtClient(credentials) {
  const nextClientKey = `${credentials.email}:${credentials.privateKey}`
  if (!jwtClient || jwtClientKey !== nextClientKey) {
    jwtClient = new JWT({
      email: credentials.email,
      key: credentials.privateKey,
      scopes: [SHEETS_READONLY_SCOPE],
    })
    jwtClientKey = nextClientKey
  }

  return jwtClient
}

function getServiceAccountCredentials(env) {
  const email = String(env.VITE_GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim()
  const privateKey = normalizePrivateKey(env.VITE_GOOGLE_PRIVATE_KEY)

  if (!email || !privateKey) {
    return null
  }

  return { email, privateKey }
}

function normalizePrivateKey(value) {
  let privateKey = String(value || '').trim()
  if (
    (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
    (privateKey.startsWith("'") && privateKey.endsWith("'"))
  ) {
    privateKey = privateKey.slice(1, -1)
  }

  return privateKey.replace(/\\n/g, '\n').trim()
}

function writeJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(payload))
}
