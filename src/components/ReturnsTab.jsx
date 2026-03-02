import React, { useState, useEffect, useMemo } from 'react'
import SeriesFilters from './SeriesFilters'
import DashboardChart from './DashboardChart'
import ReturnsPanel from './ReturnsPanel'
import {
  getSeriesLabel, getColor, formatDate,
  computeLandBase100, computeBenchmarkBase100,
  BRL_BENCHMARKS, USD_BENCHMARKS,
  resolveBenchmarkKey, cleanBenchmarkLabel,
} from '../utils/dataUtils'

const MAX_SERIES = 8

function NoticeBanner({ children }) {
  return (
    <div style={{
      background: 'rgba(33,150,243,0.08)',
      border: '1px solid rgba(33,150,243,0.2)',
      borderRadius: 6,
      padding: '7px 14px',
      fontSize: 12,
      color: 'var(--text-secondary)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <span style={{ color: 'var(--accent)', fontSize: 14, flexShrink: 0 }}>ℹ</span>
      {children}
    </div>
  )
}

function SeriesTag({ label, color, onRemove }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'var(--bg-card)',
      border: `1px solid ${color}50`,
      borderRadius: 20,
      padding: '4px 10px 4px 8px',
      fontSize: 11, color: 'var(--text-secondary)',
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ wordBreak: 'break-word' }}>
        {label}
      </span>
      <button
        onClick={onRemove}
        style={{ background: 'none', color: 'var(--text-muted)', fontSize: 16, lineHeight: 1, padding: 0, marginLeft: 2, cursor: 'pointer' }}
        title="Remove"
      >×</button>
    </div>
  )
}

function ConfirmDialog({ onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        borderRadius: 12,
        padding: 28, maxWidth: 420, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Switch Currency?</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.65 }}>
          This action will convert all values to another currency. Benchmark selections will be reset. Do you want to proceed?
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
            border: '1px solid var(--border)', borderRadius: 6,
            padding: '8px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>No, Cancel</button>
          <button onClick={onConfirm} style={{
            background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6,
            padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Yes, Switch</button>
        </div>
      </div>
    </div>
  )
}

function findDefault(landData) {
  const candidates = landData.filter(r => r.municipality.toLowerCase().includes('tasso fragoso'))
  if (!candidates.length) return null
  return (
    candidates.find(r =>
      r.group.toLowerCase().includes('agr') &&
      (r.yieldLevel.toLowerCase().includes('high') || r.yieldLevel.toLowerCase().includes('alto'))
    ) || candidates[0]
  )
}

/** Resolve the first BRL benchmark key matching a keyword (case-insensitive substring) */
function pickBenchKey(brlBenchmarks, keyword) {
  return Object.keys(brlBenchmarks).find(k => k.toUpperCase().includes(keyword.toUpperCase())) || null
}

/** Build the initial land series list from landData */
function initLandSeries(landData) {
  const def = findDefault(landData)
  if (!def) return []
  return [{ id: def.id, rowId: def.id, label: getSeriesLabel(def), rowRef: def }]
}

/** Build the initial selected-benchmark list from actual Excel keys */
function initSelectedBenchmarks(brlBenchmarks) {
  const keys = Object.keys(brlBenchmarks)
  console.log('[ReturnsTab] brlBenchmarks keys at init:', keys)
  const ipca = pickBenchKey(brlBenchmarks, 'IPCA')
  const cdi  = pickBenchKey(brlBenchmarks, 'CDI')
  const matched = [ipca, cdi].filter(Boolean)
  // Fallback: if no IPCA/CDI found, pick the first two keys available
  if (matched.length === 0 && keys.length > 0) {
    console.warn('[ReturnsTab] IPCA/CDI not found by name — falling back to first two keys:', keys.slice(0, 2))
    return keys.slice(0, 2)
  }
  console.log('[ReturnsTab] default benchmarks selected:', matched)
  return matched
}

export default function ReturnsTab({ data }) {
  const { dates, landData, brlBenchmarks, usdBenchmarks } = data

  const [currency, setCurrency] = useState('BRL')
  const [pendingCurrency, setPendingCurrency] = useState(null)
  // Lazy initialisers → correct values on the very first render, no useEffect needed
  const [landSeries, setLandSeries] = useState(() => initLandSeries(landData))
  const [selectedBenchmarks, setSelectedBenchmarks] = useState(() => initSelectedBenchmarks(brlBenchmarks))
  const [startIdx, setStartIdx] = useState(0)
  const [endIdx, setEndIdx] = useState(dates.length - 1)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const benchmarkData = currency === 'BRL' ? brlBenchmarks : usdBenchmarks
  // Show actual keys from the Excel; fall back to hardcoded list if sheet was empty
  const benchmarkNames = useMemo(() => {
    const keys = Object.keys(benchmarkData)
    return keys.length > 0 ? keys : (currency === 'BRL' ? BRL_BENCHMARKS : USD_BENCHMARKS)
  }, [benchmarkData, currency])

  const totalActive = landSeries.length + selectedBenchmarks.length
  const maxReached = totalActive >= MAX_SERIES

  // ── Currency switch ──────────────────────────────────────────────────────
  function requestCurrencySwitch(newCurrency) {
    if (newCurrency === currency) return
    if (landSeries.length > 0 || selectedBenchmarks.length > 0) {
      setPendingCurrency(newCurrency)
    } else {
      setCurrency(newCurrency)
    }
  }
  function confirmSwitch() {
    setCurrency(pendingCurrency)
    setSelectedBenchmarks([])
    setPendingCurrency(null)
  }

  // ── Add / remove land series ─────────────────────────────────────────────
  function handleAddLand(row) {
    if (totalActive >= MAX_SERIES) return
    if (landSeries.some(s => s.rowId === row.id)) return
    setLandSeries(prev => [...prev, { id: row.id, rowId: row.id, label: getSeriesLabel(row), rowRef: row }])
  }
  function handleRemoveLand(id) {
    setLandSeries(prev => prev.filter(s => s.id !== id))
  }

  // ── Benchmark toggle ─────────────────────────────────────────────────────
  function toggleBenchmark(name) {
    setSelectedBenchmarks(prev => {
      if (prev.includes(name)) return prev.filter(b => b !== name)
      if (prev.length + landSeries.length >= MAX_SERIES) return prev
      return [...prev, name]
    })
  }

  // ── Date change ──────────────────────────────────────────────────────────
  function handleStartChange(si) {
    const safeEnd = Math.max(si, endIdx)
    setStartIdx(si)
    setEndIdx(safeEnd)
  }
  function handleEndChange(ei) {
    const safeStart = Math.min(startIdx, ei)
    setStartIdx(safeStart)
    setEndIdx(ei)
  }

  // ── Compute base-100 series for chart + returns panel ────────────────────
  const allColoredSeries = useMemo(() => {
    const result = []
    let colorIdx = 0

    landSeries.forEach(s => {
      const prices = currency === 'BRL' ? s.rowRef.brlPrices : s.rowRef.usdPrices
      const vals = computeLandBase100(prices, startIdx, endIdx)
      result.push({ id: s.id, label: s.label, color: getColor(colorIdx++), values: vals, isBenchmark: false })
    })

    selectedBenchmarks.forEach(name => {
      const key = resolveBenchmarkKey(benchmarkData, name)
      const bench = key ? benchmarkData[key] : null
      if (!bench) {
        console.warn('[ReturnsTab] benchmark not found in data:', name, '| available keys:', Object.keys(benchmarkData))
        return
      }
      const vals = computeBenchmarkBase100(bench, dates, startIdx, endIdx)
      result.push({ id: `bench_${name}`, label: cleanBenchmarkLabel(name), color: getColor(colorIdx++), values: vals, isBenchmark: true })
    })

    return result
  }, [landSeries, selectedBenchmarks, currency, startIdx, endIdx, dates, benchmarkData])

  // Pre-sliced dates for the chart (same length as computed values)
  const slicedDates = useMemo(() => dates.slice(startIdx, endIdx + 1), [dates, startIdx, endIdx])

  const startDate = dates[startIdx]
  const endDate = dates[endIdx]

  const labelStyle = {
    fontSize: 10, fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  }

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {pendingCurrency && (
        <ConfirmDialog onConfirm={confirmSwitch} onCancel={() => setPendingCurrency(null)} />
      )}

      <NoticeBanner>All series are shown on a 100-index basis — starting at 100 on {formatDate(startDate)}</NoticeBanner>

      {/* Controls card */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Row 1: Currency + Period */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>

          {/* Currency toggle */}
          <div>
            <div style={{ ...labelStyle, marginBottom: 7 }}>Currency</div>
            <div style={{ display: 'inline-flex', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              {['BRL', 'USD'].map(c => (
                <button key={c} onClick={() => requestCurrencySwitch(c)} style={{
                  padding: '6px 20px', fontSize: 12, fontWeight: currency === c ? 700 : 400,
                  background: currency === c ? 'var(--accent)' : 'transparent',
                  color: currency === c ? '#fff' : 'var(--text-muted)',
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                }}>{c}</button>
              ))}
            </div>
          </div>

          {/* Period */}
          <div>
            <div style={{ ...labelStyle, marginBottom: 7 }}>Period</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select value={startIdx} onChange={e => handleStartChange(Number(e.target.value))} style={{ fontSize: 12 }}>
                {dates.map((d, i) => (
                  <option key={i} value={i}>{formatDate(d)}</option>
                ))}
              </select>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>to</span>
              <select value={endIdx} onChange={e => handleEndChange(Number(e.target.value))} style={{ fontSize: 12 }}>
                {dates.map((d, i) => (
                  <option key={i} value={i} disabled={i <= startIdx}>{formatDate(d)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Benchmarks */}
        <div>
          <div style={{ ...labelStyle, marginBottom: 8 }}>
            Benchmarks <span style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 400 }}>({currency})</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {benchmarkNames.map(name => {
              const active = selectedBenchmarks.includes(name)
              const disabled = !active && totalActive >= MAX_SERIES
              return (
                <button key={name} onClick={() => toggleBenchmark(name)} disabled={disabled} style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 11,
                  fontWeight: active ? 600 : 400,
                  background: active ? 'rgba(33,150,243,0.18)' : 'var(--bg-card)',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  border: active ? '1px solid rgba(33,150,243,0.45)' : '1px solid var(--border)',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.4 : 1,
                  transition: 'all 0.15s',
                }}>{cleanBenchmarkLabel(name)}</button>
              )
            })}
          </div>
          {maxReached && (
            <div style={{ fontSize: 11, color: '#FFD700', marginTop: 6 }}>
              You've reached the maximum of 8 series
            </div>
          )}
        </div>

        {/* Add land series accordion */}
        <div>
          <button
            onClick={() => setFiltersOpen(o => !o)}
            style={{
              background: 'none', border: 'none', padding: '0 0 8px',
              color: 'var(--accent)', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ fontSize: 14 }}>{filtersOpen ? '−' : '+'}</span>
            Add Land Series
          </button>
          {filtersOpen && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <SeriesFilters
                landData={landData}
                activeSeries={landSeries.map(s => ({ rowId: s.rowId }))}
                onAdd={handleAddLand}
                maxReached={maxReached}
              />
            </div>
          )}
        </div>
      </div>

      {/* Active series tags */}
      {allColoredSeries.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {allColoredSeries.map(s => (
            <SeriesTag
              key={s.id}
              label={s.label}
              color={s.color}
              onRemove={() => {
                if (s.isBenchmark) {
                  setSelectedBenchmarks(prev => prev.filter(b => `bench_${b}` !== s.id))
                } else {
                  handleRemoveLand(s.id)
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Chart + Returns panel (side-by-side desktop, stacked mobile) */}
      <div className="returns-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 14 }}>

        {/* Chart */}
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '16px 8px 12px', height: 460, minWidth: 0,
        }}>
          {allColoredSeries.length === 0 ? (
            <div style={{
              height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', lineHeight: 1.8,
            }}>
              Select benchmarks or add land series to compare
            </div>
          ) : (
            <DashboardChart
              series={allColoredSeries}
              slicedDates={slicedDates}
              isBRL={currency === 'BRL'}
              isIndex={true}
            />
          )}
        </div>

        {/* Returns panel */}
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 8, overflow: 'hidden', alignSelf: 'start',
          position: 'sticky', top: 76,
        }}>
          <div style={{
            padding: '10px 12px 9px',
            borderBottom: '1px solid var(--border)',
            fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>Performance</span>
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 9 }}>
              {formatDate(startDate)} – {formatDate(endDate)}
            </span>
          </div>
          <ReturnsPanel series={allColoredSeries} startDate={startDate} endDate={endDate} />
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .returns-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
