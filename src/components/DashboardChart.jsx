import React, { useState, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatDate, formatValue } from '../utils/dataUtils'

function CustomTooltip({ active, payload, label, isBRL, isIndex }) {
  if (!active || !payload || !payload.length) return null
  const date = new Date(label)
  return (
    <div style={{
      background: 'rgba(10,14,23,0.97)',
      border: '1px solid var(--border-light)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
      boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
      maxWidth: 280,
      pointerEvents: 'none',
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, fontSize: 11 }}>
        {formatDate(date)}
      </div>
      {payload.map(entry => (
        <div key={entry.dataKey} style={{
          display: 'flex', justifyContent: 'space-between', gap: 16,
          marginBottom: 3, alignItems: 'center',
        }}>
          <span style={{
            color: entry.color,
            fontSize: 11,
            maxWidth: 180,
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {entry.name}
          </span>
          <span style={{ fontWeight: 700, whiteSpace: 'nowrap', color: entry.color }}>
            {isIndex
              ? entry.value.toFixed(1)
              : formatValue(entry.value, isBRL)}
          </span>
        </div>
      ))}
    </div>
  )
}

function CustomLegend({ payload }) {
  if (!payload || !payload.length) return null
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '6px 18px',
      padding: '10px 8px 4px', justifyContent: 'center',
    }}>
      {payload.map(entry => (
        <div key={entry.value} style={{
          display: 'flex', alignItems: 'flex-start', gap: 6,
          fontSize: 10, color: 'var(--text-secondary)',
          maxWidth: 260,
        }}>
          <div style={{
            width: 18, height: 2.5, background: entry.color,
            borderRadius: 2, flexShrink: 0, marginTop: 4,
          }} />
          {/* Never truncate — show the full label, allow line-wrapping */}
          <span style={{ lineHeight: 1.4, wordBreak: 'break-word' }}>
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * DashboardChart
 * @param {Array} series - [{id, label, color, values: number[]}] — pre-sliced, same length as slicedDates
 * @param {Date[]} slicedDates - dates to display on X-axis
 * @param {boolean} isBRL
 * @param {boolean} isIndex - if true, format Y-axis as index values
 */
export default function DashboardChart({ series, slicedDates, isBRL = true, isIndex = false }) {
  const [activeLine, setActiveLine] = useState(null)

  // Build flat chart data array from pre-sliced values + dates
  const chartData = slicedDates.map((date, i) => {
    const point = { ts: date.getTime() }
    series.forEach(s => {
      const v = s.values[i]
      if (v != null && isFinite(v)) point[s.id] = v
    })
    return point
  })

  const tickFormatter = useCallback(ts => formatDate(new Date(ts)), [])

  const yFormatter = useCallback(v => {
    if (!isFinite(v)) return ''
    if (isIndex) return v.toFixed(0)
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`
    return v.toFixed(0)
  }, [isIndex])

  const totalPoints = slicedDates.length
  const minTickGap = 50
  // Show roughly 8-10 ticks
  const interval = Math.max(0, Math.floor(totalPoints / 10) - 1)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="ts"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={tickFormatter}
          interval={interval}
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
          minTickGap={minTickGap}
        />
        <YAxis
          tickFormatter={yFormatter}
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <Tooltip
          content={<CustomTooltip isBRL={isBRL} isIndex={isIndex} />}
          isAnimationActive={false}
        />
        <Legend content={<CustomLegend />} />
        {series.map(s => (
          <Line
            key={s.id}
            type="monotone"
            dataKey={s.id}
            name={s.label}
            stroke={s.color}
            strokeWidth={activeLine === s.id ? 3 : 1.8}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 0, fill: s.color }}
            connectNulls={false}
            isAnimationActive={false}
            opacity={activeLine && activeLine !== s.id ? 0.25 : 1}
            onMouseEnter={() => setActiveLine(s.id)}
            onMouseLeave={() => setActiveLine(null)}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
