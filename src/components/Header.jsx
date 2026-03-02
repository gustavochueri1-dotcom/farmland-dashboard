import React from 'react'

export default function Header({ activeTab, onTabChange, tabs }) {
  return (
    <header style={{
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{
        maxWidth: 1600,
        margin: '0 auto',
        padding: '0 20px',
      }}>
        {/* Top row: logo + title */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '12px 0 10px',
          flexWrap: 'wrap',
        }}>
          <img
            src="/insolo-logo.png"
            alt="Insolo"
            style={{ height: 36, objectFit: 'contain', flexShrink: 0 }}
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              Brazil Farmland Returns
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Based on data from S&amp;P Global
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <nav style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
          {tabs.map((tab, i) => (
            <button
              key={i}
              onClick={() => onTabChange(i)}
              style={{
                background: 'none',
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: activeTab === i ? 600 : 400,
                color: activeTab === i ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: activeTab === i ? '2px solid var(--accent)' : '2px solid transparent',
                borderRadius: 0,
                whiteSpace: 'nowrap',
                transition: 'color 0.15s, border-color 0.15s',
                letterSpacing: '0.01em',
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}
