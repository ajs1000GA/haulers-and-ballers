import { JWT } from 'google-auth-library'
import { mockRoutes, mockTeammates } from '../data/mockData'
import { parseNumber, parsePercent, safeDivide } from '../utils/formatters'

export const GOOGLE_SERVICE_ACCOUNT_EMAIL = import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_EMAIL || ''
export const GOOGLE_PRIVATE_KEY = normalizePrivateKey(import.meta.env.VITE_GOOGLE_PRIVATE_KEY || '')

export const TM_METRICS_SHEET_ID = '14qEXnzL1W0xEL-DAZcf9ydAvxgVJERMEVjUkZgPwkm8'
export const ROUTES_SHEET_ID = '1_C4jslS4QvS3UAllwx-tIf-suhWsGvlHdpzFdAGsYTM'

const SHEETS_READONLY_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly'
const TM_METRICS_RANGE = "'2TM Metrics'!D6:AH"
const ROUTE_RANGES = [
  { side: 'Westside', tab: 'LIVE ROUTES', range: "'LIVE ROUTES'!A1:ZZ100", prefix: 'AW' },
  { side: 'Eastside', tab: 'East Routes', range: "'East Routes'!A1:ZZ100", prefix: 'AE' },
]

let jwtClient

export function hasConfiguredServiceAccount() {
  return Boolean(GOOGLE_SERVICE_ACCOUNT_EMAIL && GOOGLE_PRIVATE_KEY)
}

function getJwtClient() {
  if (!jwtClient) {
    jwtClient = new JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: GOOGLE_PRIVATE_KEY,
      scopes: [SHEETS_READONLY_SCOPE],
    })
  }

  return jwtClient
}

async function getSheetsAccessToken() {
  const tokenResponse = await getJwtClient().getAccessToken()
  const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token

  if (!token) {
    throw new Error('Google service account JWT did not return an access token.')
  }

  return token
}

async function fetchSheetValues(sheetId, range) {
  if (!hasConfiguredServiceAccount()) {
    throw new Error(
      'Add VITE_GOOGLE_SERVICE_ACCOUNT_EMAIL and VITE_GOOGLE_PRIVATE_KEY to load live Google Sheets data.',
    )
  }

  const encodedRange = encodeURIComponent(range)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodedRange}?majorDimension=ROWS`
  const accessToken = await getSheetsAccessToken()
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Google Sheets request failed (${response.status}): ${message}`)
  }

  const payload = await response.json()
  return payload.values || []
}

export async function loadDashboardData() {
  if (!hasConfiguredServiceAccount()) {
    return {
      teammates: mockTeammates,
      routes: mockRoutes,
      source: 'sample',
      updatedAt: new Date(),
      warning:
        'Using sample data. Add VITE_GOOGLE_SERVICE_ACCOUNT_EMAIL and VITE_GOOGLE_PRIVATE_KEY to connect live Sheets.',
    }
  }

  try {
    const [metricsRows, ...routeRows] = await Promise.all([
      fetchSheetValues(TM_METRICS_SHEET_ID, TM_METRICS_RANGE),
      ...ROUTE_RANGES.map((routeConfig) =>
        fetchSheetValues(ROUTES_SHEET_ID, routeConfig.range).then((rows) => ({
          ...routeConfig,
          rows,
        })),
      ),
    ])

    return {
      teammates: parseTmMetrics(metricsRows),
      routes: routeRows.flatMap(parseRouteSheet),
      source: 'live',
      updatedAt: new Date(),
      warning: '',
    }
  } catch (error) {
    return {
      teammates: mockTeammates,
      routes: mockRoutes,
      source: 'sample',
      updatedAt: new Date(),
      warning: `${error.message} Showing sample data until Sheets are available.`,
    }
  }
}

export function parseTmMetrics(rows) {
  return rows
    .map((row, index) => {
      const teammate = {
        id: `tm-${index}-${row[1] || 'unknown'}`,
        sourceRow: index + 6,
        position: cleanCell(row[0]),
        name: cleanCell(row[1]),
        totalRevenue: parseNumber(row[2]),
        totalJobs: parseNumber(row[3]),
        ajs: parseNumber(row[4]),
        residentialRevenue: parseNumber(row[5]),
        resiJobs: parseNumber(row[6]),
        resiAjs: parseNumber(row[7]),
        revenuePerHour: parseNumber(row[8]),
        googleReviewsCount: parseNumber(row[10]),
        reviewsPct: parsePercent(row[11]),
        fullTruckPct: parsePercent(row[19]),
        resiOver1KCount: parseNumber(row[20]),
        resiOver1KPct: parsePercent(row[21]),
        cancelsCount: parseNumber(row[27]),
        cancelsPct: parsePercent(row[28]),
        complaintsCount: parseNumber(row[29]),
        complaintsPct: parsePercent(row[30]),
      }

      return teammate
    })
    .filter((teammate) => teammate.name && teammate.name.toLowerCase() !== 'teammate name')
}

export function parseRouteSheet(routeConfig) {
  const { rows, side, tab, prefix } = routeConfig
  if (!rows?.length) {
    return []
  }

  const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const labelColumns = findLabelColumns(rows)
  const routes = []

  for (let columnIndex = 0; columnIndex < maxColumns; columnIndex += 1) {
    if (labelColumns.has(columnIndex)) {
      continue
    }

    const routeCode = findRouteCode(rows, columnIndex, prefix)
    const teammates = [rows[3]?.[columnIndex], rows[4]?.[columnIndex], rows[5]?.[columnIndex]]
      .map(cleanCell)
      .filter(Boolean)

    const truckNumber = cleanCell(rows[9]?.[columnIndex])
    const totalRevenue = parseNumber(rows[12]?.[columnIndex])
    const residentialRevenue = parseNumber(rows[13]?.[columnIndex])

    if (!routeCode && !teammates.length && !truckNumber && !totalRevenue && !residentialRevenue) {
      continue
    }

    const jobs =
      findSummaryMetric(rows, columnIndex, ['overall jobs', 'total jobs']) ||
      findSummaryMetric(rows, columnIndex, ['jobs'], ['commercial'])
    const residentialJobs =
      findSummaryMetric(rows, columnIndex, ['residential jobs', 'resi jobs']) ||
      findSummaryMetric(rows, columnIndex, ['jobs'], ['commercial', 'overall'])
    const ajs =
      findSummaryMetric(rows, columnIndex, ['overall ajs', 'total ajs']) ||
      findSummaryMetric(rows, columnIndex, ['ajs'], ['commercial'])
    const resiAjs =
      findSummaryMetric(rows, columnIndex, ['residential ajs', 'resi ajs']) ||
      safeDivide(residentialRevenue, residentialJobs)
    const truckPlusPct =
      findSummaryMetric(rows, columnIndex, ['overall truck+', 'truck+']) ||
      findSummaryMetric(rows, columnIndex, ['full truck'])

    routes.push({
      id: `${tab}-${columnIndex}-${routeCode || truckNumber || teammates.join('-')}`,
      routeCode: routeCode || `${prefix}${routes.length + 1}`,
      side,
      tab,
      truckNumber,
      teammates,
      totalRevenue,
      residentialRevenue,
      jobs: jobs || 0,
      ajs: ajs || safeDivide(totalRevenue, jobs),
      resiAjs,
      truckPlusPct: parsePercent(truckPlusPct),
    })
  }

  return routes
}

function cleanCell(value) {
  return String(value || '').trim()
}

function normalizePrivateKey(value) {
  return String(value || '')
    .replace(/\\n/g, '\n')
    .trim()
}

function findRouteCode(rows, columnIndex, prefix) {
  const matcher = new RegExp(`\\b${prefix}\\s*-?\\s*\\d+\\b`, 'i')
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 8); rowIndex += 1) {
    const value = cleanCell(rows[rowIndex]?.[columnIndex])
    const match = value.match(matcher)
    if (match) {
      return match[0].replace(/\s|-/g, '').toUpperCase()
    }
  }

  return ''
}

function findLabelColumns(rows) {
  const labels = new Set()
  const labelWords = ['revenue', 'jobs', 'ajs', 'truck', 'residential', 'commercial', 'overall']
  const scanRows = rows.slice(57, 85)

  for (let columnIndex = 0; columnIndex < 8; columnIndex += 1) {
    const hits = scanRows.reduce((count, row) => {
      const value = cleanCell(row[columnIndex]).toLowerCase()
      return count + (labelWords.some((word) => value.includes(word)) ? 1 : 0)
    }, 0)

    if (hits >= 2) {
      labels.add(columnIndex)
    }
  }

  return labels
}

function findSummaryMetric(rows, columnIndex, requiredLabels, excludedLabels = []) {
  const required = requiredLabels.map((label) => label.toLowerCase())
  const excluded = excludedLabels.map((label) => label.toLowerCase())

  for (let rowIndex = 57; rowIndex < Math.min(rows.length, 85); rowIndex += 1) {
    const row = rows[rowIndex] || []
    const nearbyLabel = row
      .slice(0, Math.max(4, Math.min(columnIndex, 8)))
      .join(' ')
      .toLowerCase()
    const currentValue = row[columnIndex]
    const rowText = `${nearbyLabel} ${cleanCell(currentValue).toLowerCase()}`

    const hasRequired = required.some((label) => rowText.includes(label))
    const hasExcluded = excluded.some((label) => rowText.includes(label))
    if (!hasRequired || hasExcluded) {
      continue
    }

    const parsed = parseNumber(currentValue)
    if (parsed) {
      return parsed
    }

    for (let offset = 1; offset <= 2; offset += 1) {
      const adjacent = parseNumber(row[columnIndex + offset])
      if (adjacent) {
        return adjacent
      }
    }
  }

  return 0
}
