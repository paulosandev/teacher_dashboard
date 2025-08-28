'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Play, 
  Pause, 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Calendar,
  Activity
} from 'lucide-react'

interface CronStatus {
  scheduler: {
    initialized: boolean
    jobs: {
      morning: string
      afternoon: string
    }
  }
  service: {
    isUpdating: boolean
    lastUpdate: string | null
    nextScheduledUpdates: string[]
  }
}

interface UpdateLog {
  timestamp: string
  type: 'scheduled' | 'manual'
  coursesUpdated: number
  analysisGenerated: number
  activitiesUpdated: number
  errors: string[]
  duration: number
}

export default function CronAdminPage() {
  const [status, setStatus] = useState<CronStatus | null>(null)
  const [logs, setLogs] = useState<UpdateLog[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchStatus()
    fetchLogs()
    
    // Actualizar cada 30 segundos
    const interval = setInterval(() => {
      fetchStatus()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/cron?action=status')
      const data = await response.json()
      if (data.success) {
        setStatus(data.status)
      }
    } catch (error) {
      console.error('Error fetching status:', error)
    }
  }

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/cron?action=logs&limit=20')
      const data = await response.json()
      if (data.success) {
        setLogs(data.logs)
      }
    } catch (error) {
      console.error('Error fetching logs:', error)
    }
  }

  const handleAction = async (action: string) => {
    setLoading(true)
    setMessage('')
    
    try {
      const response = await fetch('/api/cron', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setMessage(`✅ ${data.message}`)
        fetchStatus()
        if (action === 'trigger') {
          fetchLogs()
        }
      } else {
        setMessage(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      setMessage(`❌ Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-MX', {
      dateStyle: 'short',
      timeStyle: 'medium'
    })
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">🤖 Sistema de Actualizaciones Automáticas</h1>

      {/* Estado del Sistema */}
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Estado del Sistema
          </h2>
          <Button
            onClick={() => fetchStatus()}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        </div>

        {status && status.scheduler ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                status.scheduler.initialized ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span>Scheduler: {status.scheduler.initialized ? 'Activo' : 'Inactivo'}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Job Matutino: {status.scheduler.jobs?.morning || 'N/A'}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Job Vespertino: {status.scheduler.jobs?.afternoon || 'N/A'}</span>
            </div>
            
            <div className="flex items-center gap-2">
              {status.service?.isUpdating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                  <span className="text-blue-500">Actualizando...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Sistema inactivo</span>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>
                Última: {status.service?.lastUpdate ? formatDate(status.service.lastUpdate) : 'Nunca'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>
                Próxima: {status.service?.nextScheduledUpdates?.[0] ? 
                  formatDate(status.service.nextScheduledUpdates[0]) : 'No programada'}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-gray-500">Cargando estado...</div>
        )}
      </Card>

      {/* Controles */}
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Controles</h2>
        
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => handleAction('start')}
            disabled={loading || status?.scheduler?.initialized}
            variant="default"
          >
            <Play className="w-4 h-4 mr-2" />
            Iniciar Scheduler
          </Button>
          
          <Button
            onClick={() => handleAction('stop')}
            disabled={loading || !status?.scheduler?.initialized}
            variant="destructive"
          >
            <Pause className="w-4 h-4 mr-2" />
            Detener Scheduler
          </Button>
          
          <Button
            onClick={() => handleAction('restart')}
            disabled={loading}
            variant="outline"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reiniciar Scheduler
          </Button>
          
          <Button
            onClick={() => handleAction('trigger')}
            disabled={loading || status?.service?.isUpdating}
            variant="secondary"
          >
            <Play className="w-4 h-4 mr-2" />
            Ejecutar Actualización Manual
          </Button>
        </div>
        
        {message && (
          <div className={`mt-4 p-3 rounded ${
            message.startsWith('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {message}
          </div>
        )}
      </Card>

      {/* Logs de Actualizaciones */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Historial de Actualizaciones</h2>
          <Button
            onClick={() => fetchLogs()}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar Logs
          </Button>
        </div>
        
        <div className="space-y-3">
          {logs.length > 0 ? (
            logs.map((log, index) => (
              <div key={index} className="border rounded p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span className="font-medium">{formatDate(log.timestamp)}</span>
                    <span className={`px-2 py-1 text-xs rounded ${
                      log.type === 'scheduled' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {log.type === 'scheduled' ? 'Programada' : 'Manual'}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    Duración: {formatDuration(log.duration)}
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span>Cursos: {log.coursesUpdated}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-blue-500" />
                    <span>Análisis: {log.analysisGenerated}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-purple-500" />
                    <span>Actividades: {log.activitiesUpdated}</span>
                  </div>
                </div>
                
                {log.errors.length > 0 && (
                  <div className="mt-2 p-2 bg-red-50 rounded text-sm">
                    <div className="flex items-center gap-1 text-red-700 mb-1">
                      <XCircle className="w-3 h-3" />
                      <span className="font-medium">Errores ({log.errors.length}):</span>
                    </div>
                    <ul className="list-disc list-inside text-red-600">
                      {log.errors.slice(0, 3).map((error, i) => (
                        <li key={i} className="truncate">{error}</li>
                      ))}
                      {log.errors.length > 3 && (
                        <li>... y {log.errors.length - 3} más</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center text-gray-500 py-8">
              No hay logs de actualizaciones disponibles
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}