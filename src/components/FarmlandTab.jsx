import React, { useState, useEffect, useMemo } from 'react'
import DashboardChart from './DashboardChart'
import {
  getSeriesLabel, getColor, formatDate, formatYieldLevel,
  getUniqueStates, getUniqueMunicipalities, getUniqueGroups,
  getUniqueSpecificUses, getUniqueYieldLevels, findRow,
} from '../utils/dataUtils'

const MAX_SERIES = 8

// ── Small shared pieces ────────────────────────────────────────────────────────

function NoticeBanner({ children }) {
  return (
    <div style={{
      background: 'rgba(33,150,243,0.08)',
      border: '1px solid rgba(33,150,243,0.2)',
      borderRadius: 6, padding: '7px 14px', fontSize: 12,
      color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ color: 'var(--accent)', fontSize: 14, flexShrink: 0 }}>ℹ</span>
      {children}
    </div>
  )
}

function SeriesTag({ series, color, onRemove }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'var(--bg-card)', border: `1px solid ${color}50`,
      borderRadius: 20, padding: '4px 10px 4px 8px',
      fontSize: 11, color: 'var(--text-secondary)',
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ wordBreak: 'break-word' }}>
        {series.label}
      </span>
      <button
        onClick={onRemove}
        style={{ background: 'none', color: 'var(--text-muted)', fontSize: 16, lineHeight: 1, padding: 0, marginLeft: 2, cursor: 'pointer' }}
        title="Remove series"
      >×</button>
    </div>
  )
}

// ── Compact label above each control ──────────────────────────────────────────
const LBL = {
  display: 'block', fontSize: 9, fontWeight: 700,
  color: 'var(--text-muted)', textTransform: 'uppercase',
  letterSpacing: '0.07em', marginBottom: 3,
}

// ── Select styling ────────────────────────────────────────────────────────────
const SEL = {
  background: 'var(--bg-card)', color: 'var(--text-primary)',
  border: '1px solid var(--border)', borderRadius: 5,
  padding: '5px 22px 5px 8px', fontSize: 11, cursor: 'pointer',
  outline: 'none', appearance: 'none', WebkitAppearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath d='M1 1l3 3 3-3' stroke='%2364748b' stroke-width='1.3' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center',
  minWidth: 90, maxWidth: 140,
}

// ── Find default series ───────────────────────────────────────────────────────
function findDefault(landData) {
  const cands = landData.filter(r => r.municipality.toLowerCase().includes('tasso fragoso'))
  if (!cands.length) return null
  return (
    cands.find(r =>
      r.group.toLowerCase().includes('agr') &&
      (r.yieldLevel.toLowerCase().includes('high') || r.yieldLevel.toLowerCase().includes('alto'))
    ) || cands[0]
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function FarmlandTab({ data, currency }) {
  const { dates, landData } = data
  const isBRL = currency === 'BRL'

  // Active chart series (each stores the full price array)
  const [activeSeries, setActiveSeries] = useState([])

  // Cascade filter state
  const [fState, setFState] = useState({ state: '', municipality: '', group: '', specificUse: '', yieldLevel: '' })

  // Date range
  const [startIdx, setStartIdx] = useState(0)
  const [endIdx, setEndIdx] = useState(dates.length - 1)

  // Load default series on mount
  useEffect(() => {
    const def = findDefault(landData)
    if (!def) return
    const prices = isBRL ? def.brlPrices : def.usdPrices
    setActiveSeries([{ id: def.id, rowId: def.id, label: getSeriesLabel(def), color: getColor(0), fullValues: prices }])
  }, [landData, isBRL])

  // ── Cascade options ──────────────────────────────────────────────────────────
  const states        = useMemo(() => getUniqueStates(landData), [landData])
  const municipalities = useMemo(() => fState.state ? getUniqueMunicipalities(landData, fState.state) : [], [landData, fState.state])
  const groups         = useMemo(() => fState.municipality ? getUniqueGroups(landData, fState.state, fState.municipality) : [], [landData, fState.state, fState.municipality])
  const specificUses   = useMemo(() => fState.group ? getUniqueSpecificUses(landData, fState.state, fState.municipality, fState.group) : [], [landData, fState.state, fState.municipality, fState.group])
  const yieldLevels    = useMemo(() => fState.group ? getUniqueYieldLevels(landData, fState.state, fState.municipality, fState.group, fState.specificUse) : [], [landData, fState.state, fState.municipality, fState.group, fState.specificUse])

  function setFilter(field, value) {
    setFState(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'state')       { next.municipality = ''; next.group = ''; next.specificUse = ''; next.yieldLevel = '' }
      if (field === 'municipality') { next.group = ''; next.specificUse = ''; next.yieldLevel = '' }
      if (field === 'group')        { next.specificUse = ''; next.yieldLevel = '' }
      if (field === 'specificUse')  { next.yieldLevel = '' }
      return next
    })
  }

  // Check if current filter selection can be added
  const matchRow   = fState.yieldLevel ? findRow(landData, fState) : null
  const isDuplicate = matchRow && activeSeries.some(s => s.rowId === matchRow.id)
  const maxReached  = activeSeries.length >= MAX_SERIES
  const canAdd      = matchRow && !isDuplicate && !maxReached

  function handleAdd() {
    if (!canAdd) return
    const row = findRow(landData, fState)
    if (!row) return
    const idx = activeSeries.length
    const prices = isBRL ? row.brlPrices : row.usdPrices
    setActiveSeries(prev => [...prev, { id: row.id, rowId: row.id, label: getSeriesLabel(row), color: getColor(idx), fullValues: prices }])
    setFState({ state: '', municipality: '', group: '', specificUse: '', yieldLevel: '' })
  }

  function handleRemove(id) {
    setActiveSeries(prev => prev.filter(s => s.id !== id).map((s, i) => ({ ...s, color: getColor(i) })))
  }

  // ── Pre-sliced data for chart ────────────────────────────────────────────────
  const slicedDates = useMemo(() => dates.slice(startIdx, endIdx + 1), [dates, startIdx, endIdx])
  const chartSeries = useMemo(() =>
    activeSeries.map(s => ({ id: s.id, label: s.label, color: s.color, values: s.fullValues.slice(startIdx, endIdx + 1) })),
    [activeSeries, startIdx, endIdx]
  )

  // ── Separator between filter groups ─────────────────────────────────────────
  const Sep = () => <div style={{ width: 1, height: 30, background: 'var(--border)', flexShrink: 0, alignSelf: 'flex-end', marginBottom: 2 }} />

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

      <NoticeBanner>
        {isBRL ? 'All figures are in BRL (R$/ha)' : 'All figures are in USD (USD/ha)'}
      </NoticeBanner>

      {/* Section label */}
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: -4 }}>
        Add Series to Chart
      </div>

      {/* ── Compact horizontal filter bar ─────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '10px 14px',
        display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '8px 10px',
      }}>

        {/* Cascade filters */}
        <div>
          <label style={LBL}>State</label>
          <select style={SEL} value={fState.state} onChange={e => setFilter('state', e.target.value)} disabled={maxReached}>
            <option value="">State…</option>
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label style={LBL}>Municipality</label>
          <select style={SEL} value={fState.municipality} onChange={e => setFilter('municipality', e.target.value)} disabled={!fState.state || maxReached}>
            <option value="">Municipality…</option>
            {municipalities.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label style={LBL}>Group</label>
          <select style={SEL} value={fState.group} onChange={e => setFilter('group', e.target.value)} disabled={!fState.municipality || maxReached}>
            <option value="">Group…</option>
            {groups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div>
          <label style={LBL}>Specific Use</label>
          <select style={SEL} value={fState.specificUse} onChange={e => setFilter('specificUse', e.target.value)} disabled={!fState.group || maxReached}>
            <option value="">(any)</option>
            {specificUses.map(u => <option key={u} value={u}>{u || '(blank)'}</option>)}
          </select>
        </div>

        <div>
          <label style={LBL}>Yield Level</label>
          <select style={SEL} value={fState.yieldLevel} onChange={e => setFilter('yieldLevel', e.target.value)} disabled={!fState.group || maxReached}>
            <option value="">Yield…</option>
            {yieldLevels.map(y => <option key={y} value={y}>{formatYieldLevel(y)}</option>)}
          </select>
        </div>

        {/* Add button */}
        <button
          onClick={handleAdd}
          disabled={!canAdd}
          title={isDuplicate ? 'Already on chart' : maxReached ? 'Max 8 series' : !matchRow ? 'Select all filters first' : 'Add to chart'}
          style={{
            alignSelf: 'flex-end',
            background: canAdd ? 'var(--accent)' : 'var(--bg-card)',
            color: canAdd ? '#fff' : 'var(--text-muted)',
            border: canAdd ? 'none' : '1px solid var(--border)',
            borderRadius: 5, padding: '6px 14px', fontSize: 11,
            fontWeight: 600, cursor: canAdd ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s', whiteSpace: 'nowrap',
          }}
        >+ Add</button>

        <Sep />

        {/* Period */}
        <div>
          <label style={LBL}>From</label>
          <select style={{ ...SEL, minWidth: 72 }} value={startIdx} onChange={e => { const si = Number(e.target.value); setStartIdx(si); if (si > endIdx) setEndIdx(si) }}>
            {dates.map((d, i) => <option key={i} value={i}>{formatDate(d)}</option>)}
          </select>
        </div>

        <div style={{ alignSelf: 'flex-end', paddingBottom: 6, color: 'var(--text-muted)', fontSize: 11 }}>to</div>

        <div>
          <label style={LBL}>To</label>
          <select style={{ ...SEL, minWidth: 72 }} value={endIdx} onChange={e => { const ei = Number(e.target.value); setEndIdx(ei); if (ei < startIdx) setStartIdx(ei) }}>
            {dates.map((d, i) => <option key={i} value={i} disabled={i < startIdx}>{formatDate(d)}</option>)}
          </select>
        </div>

        {/* Inline status messages */}
        {maxReached && (
          <div style={{ alignSelf: 'flex-end', paddingBottom: 6, fontSize: 11, color: '#FFD700', whiteSpace: 'nowrap' }}>
            Max 8 series reached
          </div>
        )}
        {isDuplicate && !maxReached && (
          <div style={{ alignSelf: 'flex-end', paddingBottom: 6, fontSize: 11, color: '#FFD700' }}>
            Already on chart
          </div>
        )}
      </div>

      {/* Active series tags */}
      {activeSeries.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {activeSeries.map(s => (
            <SeriesTag key={s.id} series={s} color={s.color} onRemove={() => handleRemove(s.id)} />
          ))}
        </div>
      )}

      {/* Chart */}
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '16px 8px 12px', height: 460,
      }}>
        {activeSeries.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Use the filters above to add a series to the chart
          </div>
        ) : (
          <DashboardChart series={chartSeries} slicedDates={slicedDates} isBRL={isBRL} isIndex={false} />
        )}
      </div>
    </div>
  )
}
