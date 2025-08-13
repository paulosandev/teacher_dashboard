'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'

export default function DiagnosticsPage() {
  const { data: session } = useSession()
  const [courseId, setCourseId] = useState('123')
  const [groupId, setGroupId] = useState('456') 
  const [userMatricula, setUserMatricula] = useState('cesar.espindola')
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<any>(null)

  const runDiagnostic = async () => {
    setIsLoading(true)
    setResults(null)
    
    try {
      const response = await fetch('/api/diagnosis/course-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          courseId,
          groupId,
          userMatricula
        })
      })
      
      const data = await response.json()
      setResults(data)
    } catch (error) {
      setResults({ error: 'Error en la petición', details: error })
    } finally {
      setIsLoading(false)
    }
  }

  if (!session) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">🔧 Diagnósticos del Sistema</h1>
        <p>Por favor inicia sesión para usar los diagnósticos.</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🔧 Diagnósticos del Sistema</h1>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h2 className="font-semibold mb-2">ℹ️ Información de Sesión</h2>
        <p><strong>Usuario:</strong> {session.user?.name}</p>
        <p><strong>Email:</strong> {session.user?.email}</p>
        <p><strong>ID:</strong> {session.user?.id}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">🧪 Diagnóstico de Curso y Grupo</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Course ID</label>
            <input
              type="text"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              placeholder="123"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Group ID</label>
            <input
              type="text"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              placeholder="456"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Matrícula</label>
            <input
              type="text"
              value={userMatricula}
              onChange={(e) => setUserMatricula(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              placeholder="cesar.espindola"
            />
          </div>
        </div>

        <button
          onClick={runDiagnostic}
          disabled={isLoading}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? '🔄 Ejecutando diagnóstico...' : '🚀 Ejecutar Diagnóstico'}
        </button>
      </div>

      {results && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">📊 Resultados del Diagnóstico</h3>
          
          {results.success && (
            <div className="mb-4">
              <div className={`p-3 rounded ${
                results.summary?.allTestsPassed 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-yellow-50 border border-yellow-200'
              }`}>
                <p className="font-medium">
                  {results.summary?.allTestsPassed ? '✅' : '⚠️'} {results.message}
                </p>
              </div>
            </div>
          )}

          {results.data?.tests && (
            <div className="space-y-4 mb-6">
              {Object.entries(results.data.tests).map(([testName, testResult]: [string, any]) => (
                <div key={testName} className="border rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium capitalize">{testName.replace(/([A-Z])/g, ' $1').trim()}</h4>
                    <span className={`px-2 py-1 rounded text-sm ${
                      testResult.status === 'success' ? 'bg-green-100 text-green-800' :
                      testResult.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {testResult.status === 'success' ? '✅ Éxito' :
                       testResult.status === 'failed' ? '❌ Fallido' :
                       '⚠️ Error'}
                    </span>
                  </div>
                  
                  {testResult.error && (
                    <p className="text-red-600 text-sm mb-2">Error: {testResult.error}</p>
                  )}
                  
                  {testResult.result && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                        Ver datos obtenidos
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto max-h-40">
                        {JSON.stringify(testResult.result, null, 2)}
                      </pre>
                    </details>
                  )}
                  
                  {testResult.count !== undefined && (
                    <p className="text-sm text-gray-600">Elementos encontrados: {testResult.count}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <details className="mt-4">
            <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
              🔍 Ver respuesta completa del servidor
            </summary>
            <pre className="mt-2 p-4 bg-gray-50 rounded text-xs overflow-auto max-h-96">
              {JSON.stringify(results, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}
