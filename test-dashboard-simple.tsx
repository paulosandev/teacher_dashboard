"use client"

import { useState, useEffect } from 'react'

export function TestDashboardSimple() {
  const [isLoading, setIsLoading] = useState(false)
  const [testData, setTestData] = useState<any>(null)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const testPersistentCache = async () => {
    setIsLoading(true)
    setTestData(null)
    addLog('Iniciando test de caché persistente')

    try {
      // Test 1: Crear datos en caché persistente
      addLog('Creando datos de test en caché persistente')
      const createResponse = await fetch('/api/analysis/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: 'TEST_SIMPLE',
          activities: [
            { id: '1', name: 'Test Activity 1', type: 'assign' }
          ],
          analysisResults: {
            'assign_1': { 
              summary: 'Test analysis', 
              fromPersistentCache: true 
            }
          },
          activitiesSummary: { total: 1 },
          courseAnalysisId: 'TEST_ANALYSIS'
        })
      })

      if (createResponse.ok) {
        addLog('✅ Datos creados en caché persistente')
        
        // Test 2: Leer datos del caché persistente
        addLog('Leyendo datos del caché persistente')
        const readResponse = await fetch('/api/analysis/cache?courseId=TEST_SIMPLE')
        
        if (readResponse.ok) {
          const data = await readResponse.json()
          if (data.success) {
            addLog('✅ Datos leídos correctamente del caché persistente')
            setTestData(data)
            addLog(`Actividades: ${data.activities?.length}, Análisis: ${Object.keys(data.analysisResults || {}).length}`)
          } else {
            addLog('❌ No se encontraron datos en caché persistente')
          }
        } else {
          addLog(`❌ Error leyendo caché: ${readResponse.status}`)
        }
      } else {
        addLog(`❌ Error creando caché: ${createResponse.status}`)
      }
    } catch (error) {
      addLog(`❌ Error en test: ${error}`)
    } finally {
      setIsLoading(false)
      addLog('Test completado')
    }
  }

  const clearTest = async () => {
    try {
      await fetch('/api/analysis/cache?courseId=TEST_SIMPLE', { method: 'DELETE' })
      addLog('🗑️ Datos de test eliminados')
      setTestData(null)
    } catch (error) {
      addLog(`❌ Error eliminando test: ${error}`)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Test Caché Persistente Simple</h1>
      
      <div className="space-x-2 mb-4">
        <button 
          onClick={testPersistentCache}
          disabled={isLoading}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          {isLoading ? 'Probando...' : 'Probar Caché Persistente'}
        </button>
        
        <button 
          onClick={clearTest}
          className="bg-red-500 text-white px-4 py-2 rounded"
        >
          Limpiar Test
        </button>

        <button 
          onClick={() => setLogs([])}
          className="bg-gray-500 text-white px-4 py-2 rounded"
        >
          Limpiar Logs
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">Logs</h2>
          <div className="bg-black text-green-400 p-4 rounded h-64 overflow-y-auto font-mono text-sm">
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Datos Recuperados</h2>
          <div className="bg-gray-100 p-4 rounded h-64 overflow-y-auto">
            {testData ? (
              <pre className="text-xs">
                {JSON.stringify(testData, null, 2)}
              </pre>
            ) : (
              <div className="text-gray-500">No hay datos</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}