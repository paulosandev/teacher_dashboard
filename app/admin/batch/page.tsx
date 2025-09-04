'use client'

import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faSpinner, 
  faDatabase, 
  faCheckCircle,
  faExclamationTriangle,
  faRefresh,
  faChartBar,
  faClock
} from '@fortawesome/free-solid-svg-icons'

interface BatchStatus {
  success: boolean
  timestamp: string
  summary: {
    totalActivities: number
    analyzedActivities: number
    pendingActivities: number
    completionPercentage: number
  }
  aulaBreakdown: Array<{
    aulaId: string
    name: string
    coursesCount: number
    activitiesCount: number
    analyzedCount: number
    pendingCount: number
    lastSync: string | null
    completionPercentage: number
  }>
  recentAnalyses: Array<{
    id: string
    aulaId: string
    activityName: string
    activityType: string
    generatedAt: string
    summary: string | null
  }>
  systemStatus: {
    isProcessing: boolean
    totalAulas: number
    lastUpdate: string
  }
}

export default function BatchAdminPage() {
  const [status, setStatus] = useState<BatchStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const loadStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/batch/status')
      const data = await response.json()
      
      if (data.success) {
        setStatus(data)
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Error cargando estado:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
    
    // Auto-refresh cada 30 segundos
    const interval = setInterval(loadStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading && !status) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FontAwesomeIcon icon={faSpinner} size="3x" className="text-blue-600 animate-spin mb-4" />
          <p className="text-gray-600">Cargando estado del sistema batch...</p>
        </div>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FontAwesomeIcon icon={faExclamationTriangle} size="3x" className="text-red-500 mb-4" />
          <p className="text-gray-600">Error cargando el estado del sistema</p>
          <button 
            onClick={loadStatus}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Panel de Administración - Sistema Batch</h1>
              <p className="text-sm text-gray-600">Monitoreo en tiempo real del procesamiento de análisis</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                Última actualización: {formatDate(lastUpdate.toISOString())}
              </div>
              <button 
                onClick={loadStatus}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
              >
                <FontAwesomeIcon icon={loading ? faSpinner : faRefresh} className={loading ? 'animate-spin' : ''} />
                <span>Actualizar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Resumen General */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <FontAwesomeIcon icon={faDatabase} className="text-blue-600 text-2xl mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Actividades</p>
                <p className="text-2xl font-bold text-gray-900">{status.summary.totalActivities.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <FontAwesomeIcon icon={faCheckCircle} className="text-green-600 text-2xl mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Analizadas</p>
                <p className="text-2xl font-bold text-gray-900">{status.summary.analyzedActivities.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <FontAwesomeIcon icon={faClock} className="text-orange-600 text-2xl mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Pendientes</p>
                <p className="text-2xl font-bold text-gray-900">{status.summary.pendingActivities.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <FontAwesomeIcon icon={faChartBar} className="text-purple-600 text-2xl mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Progreso</p>
                <p className="text-2xl font-bold text-gray-900">{status.summary.completionPercentage}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Barra de progreso general */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Progreso General del Sistema</h3>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div 
              className="bg-blue-600 h-4 rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${status.summary.completionPercentage}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-sm text-gray-600 mt-2">
            <span>{status.summary.analyzedActivities.toLocaleString()} completadas</span>
            <span>{status.summary.totalActivities.toLocaleString()} total</span>
          </div>
          
          {status.systemStatus.isProcessing && (
            <div className="mt-4 flex items-center text-sm text-blue-600">
              <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
              <span>Sistema procesando análisis automáticamente...</span>
            </div>
          )}
        </div>

        {/* Desglose por Aula */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Desglose por Aula Virtual</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aula</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cursos</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actividades</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Analizadas</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pendientes</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progreso</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Última Sync</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {status.aulaBreakdown.map((aula) => (
                  <tr key={aula.aulaId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FontAwesomeIcon icon={faDatabase} className="text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{aula.name}</div>
                          <div className="text-sm text-gray-500">{aula.aulaId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{aula.coursesCount}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{aula.activitiesCount.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{aula.analyzedCount.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">{aula.pendingCount.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className={`h-2 rounded-full ${aula.completionPercentage >= 100 ? 'bg-green-600' : 'bg-blue-600'}`}
                            style={{ width: `${aula.completionPercentage}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-900">{aula.completionPercentage}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {aula.lastSync ? formatDate(aula.lastSync) : 'Nunca'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Análisis Recientes */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Análisis Recientes (Últimos 10)</h3>
          </div>
          
          <div className="divide-y divide-gray-200">
            {status.recentAnalyses.map((analysis) => (
              <div key={analysis.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">{analysis.activityName}</h4>
                    <p className="text-sm text-gray-500">
                      {analysis.activityType} • Aula {analysis.aulaId}
                    </p>
                    {analysis.summary && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{analysis.summary}</p>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatDate(analysis.generatedAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}