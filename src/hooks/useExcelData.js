import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'

/** Convert Excel serial date to JS Date (UTC midnight) */
function excelDateToJS(serial) {
  const ms = Math.round((serial - 25569) * 86400 * 1000)
  const d = new Date(ms)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}


// Fixed column layouts confirmed from direct Excel inspection.
// Col B (idx 1) = date. Values are decimal monthly returns (0.0139 = 1.39%).
const BRL_BENCH_COLS = [
  { idx: 2, name: 'CDI' },
  { idx: 3, name: 'IPCA' },
  { idx: 4, name: 'IBOV' },
  { idx: 5, name: 'S&P' },
  { idx: 6, name: 'NASDAQ' },
]
const USD_BENCH_COLS = [
  { idx: 2, name: 'S&P' },
  { idx: 3, name: 'NASDAQ' },
  { idx: 4, name: 'Gold' },
  { idx: 5, name: 'CPI' },
  { idx: 6, name: '3-Month Treasury' },
]

/**
 * Parse a benchmark sheet using fixed column positions.
 * Date = col B (index 1), Excel serial → JS Date.
 * Values = cols specified in `columns`, decimal monthly returns.
 * Skips rows until col B contains an Excel date serial (> 25000).
 */
function parseBenchmarkSheet(rows, columns, label = 'sheet') {
  if (!rows || rows.length < 2) {
    console.warn(`[bench:${label}] Too few rows (${rows?.length ?? 0})`)
    return {}
  }

  // Find first data row: col B (idx 1) must be a number > 25000 (Excel date serial)
  let firstDataRowIdx = -1
  for (let r = 0; r < rows.length; r++) {
    const v = (rows[r] || [])[1]
    if (typeof v === 'number' && v > 25000) { firstDataRowIdx = r; break }
  }
  if (firstDataRowIdx === -1) {
    console.warn(`[bench:${label}] No date row found`)
    return {}
  }
  console.log(`[bench:${label}] first data row=${firstDataRowIdx}, cols:`, columns.map(c => `[${c.idx}]=${c.name}`))

  // Parse data rows
  const series = {}
  columns.forEach(({ name }) => { series[name] = { name, dates: [], values: [] } })

  for (let r = firstDataRowIdx; r < rows.length; r++) {
    const row = rows[r]
    if (!row) continue
    const rawDate = row[1]
    if (typeof rawDate !== 'number' || rawDate <= 25000) continue
    const date = excelDateToJS(rawDate)
    if (!date || isNaN(date.getTime())) continue

    columns.forEach(({ idx, name }) => {
      const v = row[idx]
      const num = parseFloat(v)
      if (v != null && !isNaN(num) && isFinite(num)) {
        series[name].dates.push(date)
        series[name].values.push(num)
      }
    })
  }

  Object.keys(series).forEach(name => {
    if (!series[name].dates.length) delete series[name]
  })

  console.log(`[bench:${label}] final series:`,
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
        const res = await fetch('/Excel - Farmland Dashboard - Dataset.xlsx')
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
        const brlRaw = XLSX.utils.sheet_to_json(brlSheet,   opts)
        const usdRaw = XLSX.utils.sheet_to_json(usdSheet,   opts)

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
            state:       String(bRow[1] || '').trim(),
            municipality:String(bRow[2] || '').trim(),
            group:       String(bRow[3] || '').trim(),
            specificUse: String(bRow[4] || '').trim(),
            yieldLevel:  String(bRow[5] || '').trim(),
            brlPrices,
            usdPrices,
          })
        }

        const brlBenchmarks = parseBenchmarkSheet(XLSX.utils.sheet_to_json(brlBenchSh, opts), BRL_BENCH_COLS, 'BRL')
        const usdBenchmarks = parseBenchmarkSheet(XLSX.utils.sheet_to_json(usdBenchSh, opts), USD_BENCH_COLS, 'USD')

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
