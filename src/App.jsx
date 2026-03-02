import React, { useState } from 'react'
import { useExcelData } from './hooks/useExcelData'
import Header from './components/Header'
import LoadingScreen from './components/LoadingScreen'
import FarmlandTab from './components/FarmlandTab'
import ReturnsTab from './components/ReturnsTab'

const TABS = [
  { label: 'Farmland Prices in BRL', currency: 'BRL' },
  { label: 'Farmland Prices in USD', currency: 'USD' },
  { label: 'Farmland Returns vs. Major Asset Classes', currency: null },
]

export default function App() {
  const { data, loading, error } = useExcelData()
  const [activeTab, setActiveTab] = useState(0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header activeTab={activeTab} onTabChange={setActiveTab} tabs={TABS} />

      {loading && <LoadingScreen />}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flex: 1, padding: 32, color: '#E91E63', textAlign: 'center',
        }}>
          <div>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Failed to load data</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{error}</div>
          </div>
        </div>
      )}

      {data && !loading && (
        <main style={{ flex: 1 }}>
          {activeTab === 0 && <FarmlandTab key="brl" data={data} currency="BRL" />}
          {activeTab === 1 && <FarmlandTab key="usd" data={data} currency="USD" />}
          {activeTab === 2 && <ReturnsTab data={data} />}
        </main>
      )}
    </div>
  )
}
