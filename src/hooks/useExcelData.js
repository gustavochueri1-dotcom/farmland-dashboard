import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'

/** Convert Excel serial date to JS Date (UTC midnight) */
function excelDateToJS(serial) {
  const ms = Math.round((serial - 25569) * 86400 * 1000)
  const d = new Date(ms)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

// ─────────────────────────────────────────────────────────────────────────────
// Bench parsing helpers (robust to empty leading columns / different ranges)
// ─────────────────────────────────────────────────────────────────────────────

function isExcelSerialDate(v) {
  return typeof v === 'number' && Number.isFinite(v) && v > 25000 && v < 60000
}

function normalizeDateCell(v) {
  if (v == null) return null

  // Excel serial
  if (isExcelSerialDate(v)) return excelDateToJS(v)

  // XLSX may return Date
  if (v instanceof Date && !isNaN(v.getTime())) {
    return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()))
  }

  // String like "31/12/2001"
  if (typeof v === 'string') {
    const s = v.trim()
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (m) {
      const dd = Number(m[1])
      const mm = Number(m[2]) - 1
      const yyyy = Number(m[3])
      const d = new Date(Date.UTC(yyyy, mm, dd))
      return isNaN(d.getTime()) ? null : d
    }

    // fallback: Date parse
    const d2 = new Date(s)
    if (!isNaN(d2.getTime())) {
      return new Date(Date.UTC(d2.getUTCFullYear(), d2.getUTCMonth(), d2.getUTCDate()))
    }
  }

  return null
}

function findHeaderAndDateCol(rows) {
  // Find a row containing "Monthly Returns"
  const headerRowIdx = rows.findIndex(r =>
    r?.some(c => typeof c === 'string' && c.toLowerCase().includes('monthly returns'))
  )

  const hdr = headerRowIdx >= 0 ? headerRowIdx : 0
  const headerRow = rows[hdr] || []

  // Date col = where "Monthly Returns" lives
  let dateCol = headerRow.findIndex(
    c => typeof c === 'string' && c.toLowerCase().includes('monthly returns')
  )

  // Fallback: probe next row(s) and pick first date-like column
  if (dateCol < 0) {
    const probe = rows[hdr + 1] || rows[0] || []
    dateCol = probe.findIndex(v => normalizeDateCell(v))
  }

  if (dateCol < 0) dateCol = 0
  return { hdr, dateCol }
}

// Fixed column layouts confirmed from direct Excel inspection.
// Now expressed as OFFSETS relative to the date column.
const BRL_BENCH_COLS = [
  { off: 1, name: 'CDI' },
  { off: 2, name: 'IPCA' },
  { off: 3, name: 'IBOV' },
  { off: 4, name: 'S&P' },
  { off: 5, name: 'NASDAQ' },
]
const USD_BENCH_COLS = [
  { off: 1, name: 'S&P' },
  { off: 2, name: 'NASDAQ' },
  { off: 3, name: 'Gold' },
  { off: 4, name: 'CPI' },
  { off: 5, name: '3-Month Treasury' },
]

/**
 * Parse a benchmark sheet robustly.
 * - Detect date column via the header cell containing "Monthly Returns"
 *   (or fallback: first date-like column).
 * - Accept Excel serial dates, Date objects, or dd/mm/yyyy strings.
 * - Read values by offsets relative to dateCol.
 */
function parseBenchmarkSheet(rows, columns, label = 'sheet') {
  if (!rows || rows.length < 2) {
    console.warn(`[bench:${label}] Too few rows (${rows?.length ?? 0})`)
    return {}
  }

  const { hdr, dateCol } = findHeaderAndDateCol(rows)

  // Find first data row below header where date cell exists
  let firstDataRowIdx = -1
  for (let r = hdr + 1; r < rows.length; r++) {
    const dt = normalizeDateCell((rows[r] || [])[dateCol])
    if (dt) { firstDataRowIdx = r; break }
  }

  if (firstDataRowIdx === -1) {
    console.warn(
      `[bench:${label}] No date row found (hdr=${hdr}, dateCol=${dateCol}).`,
      'Sample:', rows.slice(0, 6)
    )
    return {}
  }

  console.log(
    `[bench:${label}] hdrRow=${hdr}, dateCol=${dateCol}, firstDataRow=${firstDataRowIdx}, cols:`,
    columns.map(c => `[dateCol+${c.off}]=${c.name}`)
  )

  const series = {}
  columns.forEach(({ name }) => { series[name] = { name, dates: [], values: [] } })

  for (let r = firstDataRowIdx; r < rows.length; r++) {
    const row = rows[r]
    if (!row) continue

    const date = normalizeDateCell(row[dateCol])
    if (!date || isNaN(date.getTime())) continue

    columns.forEach(({ off, name }) => {
      const v = row[dateCol + off]
      const num = (typeof v === 'number') ? v : parseFloat(v)
      if (v != null && !isNaN(num) && isFinite(num)) {
        series[name].dates.push(date)
        series[name].values.push(num)
      }
    })
  }

  Object.keys(series).forEach(name => {
    if (!series[name].dates.length) delete series[name]
  })

  console.log(
    `[bench:${label}] final series:`,
    Object.keys(series).map(k => `${k}(${series[k].dates.length} pts, first=${series[k].values[0]})`)
  )

  return series
}

export function useExcelData() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/dataset.xlsx')
        if (!res.ok) throw new Error(`HTTP ${res.status}: failed to load farmland-data.xlsx`)
        const buf = await res.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array', raw: true })

        const sheetNames = wb.SheetNames
        const findSheet = (needle) => {
          const found = sheetNames.find(s => s.toLowerCase().includes(needle.toLowerCase()))
          if (!found) throw new Error(`Sheet containing "${needle}" not found. Available: ${sheetNames.join(', ')}`)
          return wb.Sheets[found]
        }

        const brlSheet    = findSheet('Farmland Prices in BRL')
        const usdSheet    = findSheet('Farmland Prices in USD')
        const brlBenchSh  = findSheet('BRL Benchmarks')
        const usdBenchSh  = findSheet('USD Benchmarks')

        const opts = { header: 1, raw: true, defval: null }
        const brlRaw = XLSX.utils.sheet_to_json(brlSheet, opts)
        const usdRaw = XLSX.utils.sheet_to_json(usdSheet, opts)

        // Row index 1 = Excel row 2 = date headers starting at column G (index 6)
        const dateRow = brlRaw[1] || []
        const dates = []
        const COL_START = 6
        for (let c = COL_START; c < dateRow.length; c++) {
          const v = dateRow[c]
          if (v != null && typeof v === 'number') dates.push(excelDateToJS(v))
        }

        // Land data: Excel rows 3+ = array indices 2+
        const landData = []
        const maxR = Math.max(brlRaw.length, usdRaw.length)
        for (let i = 2; i < maxR; i++) {
          const bRow = brlRaw[i]
          const uRow = usdRaw[i]
          if (!bRow || !bRow[1]) continue

          const brlPrices = []
          const usdPrices = []
          for (let c = 0; c < dates.length; c++) {
            const bv = bRow[COL_START + c]
            const uv = uRow ? uRow[COL_START + c] : null
            brlPrices.push(bv != null && !isNaN(bv) ? parseFloat(bv) : null)
            usdPrices.push(uv != null && !isNaN(uv) ? parseFloat(uv) : null)
          }

          landData.push({
            id: `land_${i}`,
            rowIndex: i,
            state:        String(bRow[1] || '').trim(),
            municipality: String(bRow[2] || '').trim(),
            group:        String(bRow[3] || '').trim(),
            specificUse:  String(bRow[4] || '').trim(),
            yieldLevel:   String(bRow[5] || '').trim(),
            brlPrices,
            usdPrices,
          })
        }

        const brlBenchmarks = parseBenchmarkSheet(
          XLSX.utils.sheet_to_json(brlBenchSh, opts),
          BRL_BENCH_COLS,
          'BRL'
        )
        const usdBenchmarks = parseBenchmarkSheet(
          XLSX.utils.sheet_to_json(usdBenchSh, opts),
          USD_BENCH_COLS,
          'USD'
        )

        console.log('[useExcelData] BRL benchmark keys:', Object.keys(brlBenchmarks))
        console.log('[useExcelData] USD benchmark keys:', Object.keys(usdBenchmarks))
        console.log('[useExcelData] Land rows:', landData.length, '| Dates:', dates.length)

        setData({ dates, landData, brlBenchmarks, usdBenchmarks })
        setLoading(false)
      } catch (err) {
        console.error('[useExcelData]', err)
        setError(err.message)
        setLoading(false)
      }
    }
    load()
  }, [])

  return { data, loading, error }
}