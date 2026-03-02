import React, { useState } from 'react'
import {
  getUniqueStates,
  getUniqueMunicipalities,
  getUniqueGroups,
  getUniqueSpecificUses,
  getUniqueYieldLevels,
  findRow,
  getSeriesLabel,
  formatYieldLevel,
} from '../utils/dataUtils'

const SEL = {
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '6px 28px 6px 10px',
  fontSize: 12,
  cursor: 'pointer',
  outline: 'none',
  appearance: 'none',
  WebkitAppearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2364748b' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
  width: '100%',
}

export default function SeriesFilters({ landData, activeSeries, onAdd, maxReached }) {
  const [filters, setFilters] = useState({
    state: '', municipality: '', group: '', specificUse: '', yieldLevel: '',
  })

  const states = getUniqueStates(landData)
  const municipalities = filters.state ? getUniqueMunicipalities(landData, filters.state) : []
  const groups = filters.municipality ? getUniqueGroups(landData, filters.state, filters.municipality) : []
  const specificUses = filters.group ? getUniqueSpecificUses(landData, filters.state, filters.municipality, filters.group) : []
  const yieldLevels = filters.group
    ? getUniqueYieldLevels(landData, filters.state, filters.municipality, filters.group, filters.specificUse)
    : []

  // Check if current selection already exists
  const matchRow = filters.yieldLevel
    ? findRow(landData, filters)
    : null
  const isDuplicate = matchRow && activeSeries.some(s => s.rowId === matchRow.id)
  const canAdd = matchRow && !isDuplicate && !maxReached

  function set(field, value) {
    const next = { ...filters, [field]: value }
    // Reset downstream filters
    if (field === 'state') { next.municipality = ''; next.group = ''; next.specificUse = ''; next.yieldLevel = '' }
    if (field === 'municipality') { next.group = ''; next.specificUse = ''; next.yieldLevel = '' }
    if (field === 'group') { next.specificUse = ''; next.yieldLevel = '' }
    if (field === 'specificUse') { next.yieldLevel = '' }
    setFilters(next)
  }

  function handleAdd() {
    if (!canAdd) return
    const row = findRow(landData, filters)
    if (!row) return
    onAdd(row)
    setFilters({ state: '', municipality: '', group: '', specificUse: '', yieldLevel: '' })
  }

  const labelStyle = {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 4,
    display: 'block',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {maxReached && (
        <div style={{
          background: 'rgba(233,30,99,0.12)',
          border: '1px solid rgba(233,30,99,0.3)',
          borderRadius: 6,
          padding: '7px 12px',
          fontSize: 12,
          color: '#E91E63',
          fontWeight: 500,
        }}>
          You've reached the maximum of 8 series
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
        {/* State */}
        <div>
          <label style={labelStyle}>State</label>
          <select style={SEL} value={filters.state} onChange={e => set('state', e.target.value)} disabled={maxReached}>
            <option value="">Select…</option>
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Municipality */}
        <div>
          <label style={labelStyle}>Municipality</label>
          <select style={SEL} value={filters.municipality} onChange={e => set('municipality', e.target.value)} disabled={!filters.state || maxReached}>
            <option value="">Select…</option>
            {municipalities.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Group */}
        <div>
          <label style={labelStyle}>Group</label>
          <select style={SEL} value={filters.group} onChange={e => set('group', e.target.value)} disabled={!filters.municipality || maxReached}>
            <option value="">Select…</option>
            {groups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        {/* Specific Use */}
        <div>
          <label style={labelStyle}>Specific Use</label>
          <select style={SEL} value={filters.specificUse} onChange={e => set('specificUse', e.target.value)} disabled={!filters.group || maxReached}>
            <option value="">(any)</option>
            {specificUses.map(u => <option key={u} value={u}>{u || '(blank)'}</option>)}
          </select>
        </div>

        {/* Yield Level */}
        <div>
          <label style={labelStyle}>Yield Level</label>
          <select style={SEL} value={filters.yieldLevel} onChange={e => set('yieldLevel', e.target.value)} disabled={!filters.group || maxReached}>
            <option value="">Select…</option>
            {yieldLevels.map(y => <option key={y} value={y}>{formatYieldLevel(y)}</option>)}
          </select>
        </div>
      </div>

      {isDuplicate && (
        <div style={{ fontSize: 11, color: '#FFD700' }}>This series is already on the chart.</div>
      )}

      <button
        onClick={handleAdd}
        disabled={!canAdd}
        style={{
          alignSelf: 'flex-start',
          background: canAdd ? 'var(--accent)' : 'var(--bg-card)',
          color: canAdd ? '#fff' : 'var(--text-muted)',
          padding: '7px 18px',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          cursor: canAdd ? 'pointer' : 'not-allowed',
          transition: 'background 0.15s',
          border: canAdd ? 'none' : '1px solid var(--border)',
        }}
      >
        + Add to Chart
      </button>
    </div>
  )
}
