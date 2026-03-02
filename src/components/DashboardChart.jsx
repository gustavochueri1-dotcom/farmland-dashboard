import React, { useState, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatDate, formatValue } from '../utils/dataUtils'

function CustomTooltip({ active, payload, label, isBRL, isIndex }) {
  if (!active || !payload || !payload.length) return null
  const date = new Date(Number(label))

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
        <div
          key={entry.dataKey}
          style={{
            display: 'flex', justifyContent: 'space-between', gap: 16,
            marginBottom: 3, alignItems: 'center',
          }}
        >
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
              ? Number(entry.value).toFixed(1)
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
        <div
          key={entry.value}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 6,
            fontSize: 10, color: 'var(--text-secondary)',
            maxWidth: 260,
          }}
        >
          <div style={{
            width: 18, height: 2.5, background: entry.color,
            borderRadius: 2, flexShrink: 0, marginTop: 4,
          }} />
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

  // Mobile detection (simple & enough for your use-case)
  const isMobile = window.innerWidth < 768

  // Build flat chart data array from pre-sliced values + dates
  const chartData = slicedDates.map((date, i) => {
    const point = { ts: date.getTime() }
    series.forEach(s => {
      const v = s.values[i]
      if (v != null && isFinite(v)) point[s.id] = v
    })
    return point
  })

  /**
   * X-axis ticks
   * - Mobile: exactly 6 labels (start, 4 middle, end)
   * - Desktop: ~10 labels, ALWAYS includes last datapoint so if user selected To=Jun/25,
   *   Jun/25 shows up on the axis.
   */
  const xTicks = (() => {
    if (!chartData || chartData.length === 0) return undefined

    const n = chartData.length
    const want = isMobile ? 6 : 10
    if (n <= want) {
      const all = chartData
        .map(p => p?.ts)
        .filter(v => typeof v === 'number' && Number.isFinite(v))
      return all.length ? all : undefined
    }

    const idxs = []
    for (let i = 0; i < want; i++) {
      idxs.push(Math.round((n - 1) * (i / (want - 1))))
    }

    // ensure unique + sorted
    const uniq = Array.from(new Set(idxs)).sort((a, b) => a - b)

    // GUARANTEE last tick = last datapoint
    if (uniq[uniq.length - 1] !== n - 1) uniq.push(n - 1)

    const ticks = uniq
      .map(i => chartData[i]?.ts)
      .filter(v => typeof v === 'number' && Number.isFinite(v))

    return ticks.length ? ticks : undefined
  })()

  const tickFormatter = useCallback(ts => formatDate(new Date(Number(ts))), [])

  const yFormatter = useCallback(v => {
    if (!isFinite(v)) return ''
    if (isIndex) return Number(v).toFixed(0)
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`
    return Number(v).toFixed(0)
  }, [isIndex])

  const totalPoints = slicedDates.length

  // Keep your existing desktop behavior if we weren't forcing ticks.
  // (But once ticks are provided, we set interval=0 and ticks control the labels.)
  const interval = Math.max(0, Math.floor(totalPoints / 10) - 1)

  return (
    <ResponsiveContainer width="100%" height={isMobile ? 420 : 600}>
      <LineChart
        data={chartData}
        margin={{
          top: 20,
          right: 20,
          left: 10,
          bottom: isMobile ? 80 : 20,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />

        <XAxis
          dataKey="ts"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={tickFormatter}
          ticks={xTicks}
          interval={xTicks ? 0 : (isMobile ? 0 : interval)}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          minTickGap={isMobile ? 9999 : 20}
          angle={isMobile ? -35 : 0}
          textAnchor={isMobile ? 'end' : 'middle'}
        />

        <YAxis
          tickFormatter={yFormatter}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />

        <Tooltip
          content={<CustomTooltip isBRL={isBRL} isIndex={isIndex} />}
          labelFormatter={(label) => formatDate(new Date(Number(label)))}
        />

        <Legend
          content={<CustomLegend />}
          layout={isMobile ? 'vertical' : 'horizontal'}
          verticalAlign={isMobile ? 'bottom' : 'top'}
        />

        {series.map((s) => (
          <Line
            key={s.id}
            type="monotone"
            dataKey={s.id}
            name={s.label}
            stroke={s.color}
            strokeWidth={activeLine && activeLine !== s.id ? 1.5 : 2}
            dot={false}
            opacity={activeLine && activeLine !== s.id ? 0.3 : 1}
            onMouseEnter={() => setActiveLine(s.id)}
            onMouseLeave={() => setActiveLine(null)}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}