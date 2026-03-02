import React from 'react'

export default function LoadingScreen() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      gap: 16,
      padding: 40,
      color: 'var(--text-muted)',
    }}>
      <div style={{
        width: 40,
        height: 40,
        border: '3px solid var(--border)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <div style={{ fontSize: 13 }}>Loading dataset…</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
