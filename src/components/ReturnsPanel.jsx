import React from 'react'
import { computeTotalReturn, computeCAGR } from '../utils/dataUtils'

function fmtPct(val, decimals = 1) {
  if (val == null || !isFinite(val)) return '–'
  const sign = val >= 0 ? '+' : ''
  return `${sign}${val.toFixed(decimals)}%`
}

function color(val) {
  if (val == null || !isFinite(val)) return 'var(--text-muted)'
  return val >= 0 ? '#4CAF50' : '#E91E63'
}

export default function ReturnsPanel({ series, startDate, endDate }) {
  if (!series || series.length === 0) return (
    <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 16, textAlign: 'center' }}>
      Add series to see returns
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 84px 110px',
        gap: 8,
        padding: '6px 12px',
        borderBottom: '1px solid var(--border)',
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>
        <span>Series</span>
        <span style={{ textAlign: 'right' }}>Total Return</span>
        <span style={{ textAlign: 'right' }}>Annualized Return</span>
      </div>

      {series.map(s => {
        const total = computeTotalReturn(s.values)
        const cagr = computeCAGR(s.values, startDate, endDate)
        return (
          <div
            key={s.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 84px 110px',
              gap: 8,
              padding: '8px 12px',
              borderBottom: '1px solid var(--border)',
              alignItems: 'center',
            }}
          >
            {/* Series name with color dot */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, minWidth: 0 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: s.color, flexShrink: 0, marginTop: 3,
              }} />
              <span style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                lineHeight: 1.35,
                overflowWrap: 'break-word',
              }}>
                {s.label}
              </span>
            </div>
            {/* Total Return */}
            <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: color(total) }}>
              {fmtPct(total, 0)}
            </div>
            {/* Annualized Return */}
            <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: color(cagr) }}>
              {fmtPct(cagr, 1)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
