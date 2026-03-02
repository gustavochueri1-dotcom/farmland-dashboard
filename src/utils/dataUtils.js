// ─── Benchmark Label Cleaning ────────────────────────────────────────────────

/**
 * Return a clean short label for a benchmark series key.
 * "Monthly IPCA %" → "IPCA", "CDI (Daily)" → "CDI", etc.
 */
export function cleanBenchmarkLabel(rawKey) {
  if (!rawKey) return rawKey
  // Known canonical names — check if the raw key contains any of them
  const KNOWN = ['IPCA', 'CDI', 'IBOV', 'S&P', 'NASDAQ', 'SELIC', 'CPI', 'Gold', 'Treasury', 'IFIX']
  for (const k of KNOWN) {
    if (rawKey.toUpperCase().includes(k.toUpperCase())) return k
  }
  // Fallback: strip "Monthly/Annual/Weekly/Daily" prefix and "%" suffix
  return rawKey
    .replace(/^(monthly|annual|weekly|daily)\s+/i, '')
    .replace(/\s*[%]\s*$/i, '')
    .trim()
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const SERIES_COLORS = [
  '#2196F3', '#FF6B35', '#4CAF50', '#FFD700',
  '#E91E63', '#00BCD4', '#FF5722', '#9C27B0',
]

export const BRL_BENCHMARKS = ['IPCA', 'CDI', 'IBOV', 'S&P (BRL)', 'NASDAQ (BRL)']
export const USD_BENCHMARKS = ['S&P', 'NASDAQ', 'Gold', '3-Month Treasury', 'CPI (US Inflation)']

// Fruit crops that trigger showing Specific Use in labels
const FRUIT_CROPS = [
  'apple', 'banana', 'cashew', 'cocoa', 'coconut',
  'coffee', 'melon', 'orange', 'papaya', 'pineapple',
]

// ─── Series Label ─────────────────────────────────────────────────────────────

/** Expand bare "High" / "Medium" / "Low" → "High Yield" etc. */
export function formatYieldLevel(yl) {
  if (!yl) return yl
  if (/yield/i.test(yl)) return yl   // already contains "Yield" — leave alone
  const low = yl.toLowerCase()
  if (low === 'high')   return 'High Yield'
  if (low === 'medium') return 'Medium Yield'
  if (low === 'low')    return 'Low Yield'
  return yl
}

export function getSeriesLabel(row) {
  const showSU =
    row.specificUse &&
    FRUIT_CROPS.some(f => row.specificUse.toLowerCase().includes(f))
  const parts = [row.state, row.municipality, row.group]
  if (showSU) parts.push(row.specificUse)
  if (row.yieldLevel) parts.push(formatYieldLevel(row.yieldLevel))
  return parts.filter(Boolean).join('; ')
}

export function getColor(index) {
  return SERIES_COLORS[index % SERIES_COLORS.length]
}

// ─── Date Formatting ─────────────────────────────────────────────────────────

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function formatDate(date) {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  return `${MONTH_ABBR[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`
}

export function formatValue(val, isBRL = true) {
  if (val == null || isNaN(val)) return '–'
  if (isBRL) return `R$${val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ─── Cascading Filter Helpers ─────────────────────────────────────────────────

export function getUniqueStates(landData) {
  return [...new Set(landData.map(r => r.state).filter(Boolean))].sort()
}

export function getUniqueMunicipalities(landData, state) {
  return [...new Set(
    landData.filter(r => !state || r.state === state).map(r => r.municipality).filter(Boolean)
  )].sort()
}

export function getUniqueGroups(landData, state, municipality) {
  return [...new Set(
    landData.filter(r =>
      (!state || r.state === state) && (!municipality || r.municipality === municipality)
    ).map(r => r.group).filter(Boolean)
  )].sort()
}

export function getUniqueSpecificUses(landData, state, municipality, group) {
  return [...new Set(
    landData.filter(r =>
      (!state || r.state === state) &&
      (!municipality || r.municipality === municipality) &&
      (!group || r.group === group)
    ).map(r => r.specificUse).filter(Boolean)
  )].sort()
}

export function getUniqueYieldLevels(landData, state, municipality, group, specificUse) {
  // Exact match on specificUse ('' = blank rows)
  const suMatch = specificUse || ''
  return [...new Set(
    landData.filter(r =>
      (!state || r.state === state) &&
      (!municipality || r.municipality === municipality) &&
      (!group || r.group === group) &&
      r.specificUse === suMatch
    ).map(r => r.yieldLevel).filter(Boolean)
  )].sort()
}

export function findRow(landData, { state, municipality, group, specificUse, yieldLevel }) {
  return landData.find(r =>
    r.state === state &&
    r.municipality === municipality &&
    r.group === group &&
    r.specificUse === (specificUse || '') &&
    r.yieldLevel === yieldLevel
  )
}

/**
 * Resolve an exact or fuzzy benchmark key from the benchmarkData object.
 */
export function resolveBenchmarkKey(benchmarkData, displayName) {
  if (!benchmarkData) return null
  if (benchmarkData[displayName]) return displayName
  const lower = displayName.toLowerCase()
  return (
    Object.keys(benchmarkData).find(k => k.toLowerCase().includes(lower)) ||
    Object.keys(benchmarkData).find(k => lower.includes(k.toLowerCase())) ||
    null
  )
}

// ─── Returns Computation ──────────────────────────────────────────────────────

export function computeTotalReturn(values) {
  const first = values.find(v => v != null && isFinite(v))
  const last  = [...values].reverse().find(v => v != null && isFinite(v))
  if (first == null || last == null || first === 0) return null
  return ((last / first) - 1) * 100
}

export function computeCAGR(values, startDate, endDate) {
  const first = values.find(v => v != null && isFinite(v))
  const last  = [...values].reverse().find(v => v != null && isFinite(v))
  if (first == null || last == null || first === 0) return null
  const years = (endDate - startDate) / (365.25 * 24 * 3600 * 1000)
  if (years <= 0) return null
  return (Math.pow(last / first, 1 / years) - 1) * 100
}

// ─── Land Base-100 ────────────────────────────────────────────────────────────

export function computeLandBase100(prices, startIdx, endIdx) {
  const slice = prices.slice(startIdx, endIdx + 1)
  const baseVal = slice.find(v => v != null && isFinite(v) && v > 0)
  if (baseVal == null) return slice.map(() => null)
  return slice.map(v => (v != null && isFinite(v) ? (v / baseVal) * 100 : null))
}

// ─── Benchmark Base-100 ───────────────────────────────────────────────────────

/**
 * Compute base-100 index for a benchmark series aligned to land dates.
 *
 * All benchmark values are decimal monthly returns (e.g. 0.0139 = 1.39 %/month).
 * Between consecutive land dates (bimonthly), all intervening monthly returns
 * are compounded: index = prev × (1 + r).
 *
 * @param {object} benchSeries  – { name, dates: Date[], values: number[] }
 * @param {Date[]} landDates    – full array of land data dates
 * @param {number} startIdx     – index into landDates for the period start
 * @param {number} endIdx       – index into landDates for the period end
 * @returns {number[]}          – array of length (endIdx − startIdx + 1), starts at 100
 */
function normalizeMonthlyReturn(x) {
  if (x == null || !Number.isFinite(x)) return 0
  return Math.abs(x) > 1 ? x / 100 : x
}

function nearestIndex(sortedTs, targetTs) {
  let lo = 0, hi = sortedTs.length - 1
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (sortedTs[mid] < targetTs) lo = mid + 1
    else hi = mid
  }
  const after = lo
  const before = Math.max(0, lo - 1)
  if (before === after) return after
  return (Math.abs(sortedTs[after] - targetTs) < Math.abs(targetTs - sortedTs[before]))
    ? after
    : before
}

export function computeBenchmarkBase100(benchSeries, landDates, startIdx, endIdx) {
  if (!benchSeries?.dates?.length || !benchSeries?.values?.length) {
    console.warn('[benchmark] Empty series:', benchSeries?.name)
    return Array(endIdx - startIdx + 1).fill(null)
  }

  // 1) base-100 on benchmark's own timeline
  const benchTs = benchSeries.dates.map(d => d.getTime())
  const base = []
  let idx = 100

  for (let i = 0; i < benchSeries.values.length; i++) {
    const r = normalizeMonthlyReturn(benchSeries.values[i])
    if (i === 0) idx = 100
    else idx *= (1 + r)
    base.push(idx)
  }

  // 2) resample to land dates (nearest benchmark date)
  const out = []
  for (let i = startIdx; i <= endIdx; i++) {
    const ts = landDates[i].getTime()
    const j = nearestIndex(benchTs, ts)
    out.push(Number.isFinite(base[j]) ? base[j] : null)
  }

  return out
}