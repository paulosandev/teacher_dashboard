'use client'

/**
 * Dashboard de administración para monitoreo de ejecuciones
 * Usa NextAuth para autenticación
 */

import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import DetailsModal from '@/components/DetailsModal'

interface ExecutionStatus {
  isRunning: boolean
  lastActivity?: any
  minutesSinceLastUpdate: number
  estimatedEndTime?: string | null
}

interface SystemInfo {
  totalAulas: number
  totalCourses: number
  totalActivities: number
  systemTimezone: string
  dbTimezone: string
}

interface CronSchedule {
  nextExecution: string
  nextExecutionType: string
  nextExecutionLocal: string
  hoursUntilNext: number
  lastScheduledExecution: string
  lastExecutionType: string
  lastExecutionLocal: string
  hoursSinceLast: number
  scheduleInfo: {
    morning: string
    evening: string
    timezone: string
  }
}

interface ReportData {
  timestamp: string
  reportType: string
  queryTime: number
  systemInfo: SystemInfo
  currentStatus?: ExecutionStatus
  execution?: any
  cronSchedule?: CronSchedule
  dailyStats?: any[]
  aulaInfo?: any
  recentActivity?: any[]
  summary?: any
  errorAnalysis?: any[]
  performanceMetrics?: any[]
}

export default function AdminReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selectedAula, setSelectedAula] = useState('')
  const [activeTab, setActiveTab] = useState('current')
  const [showDetailsModal, setShowDetailsModal] = useState<'aulas' | 'cursos' | 'actividades' | null>(null)
  const [modalData, setModalData] = useState<any>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [cronStatus, setCronStatus] = useState<any>(null)

  // Verificar autenticación
  useEffect(() => {
    if (status === 'loading') return // Aún cargando
    
    if (status === 'unauthenticated' || !session?.user || session?.user?.role !== 'admin') {
      window.location.href = '/admin/login'
      return
    }
    
    // Usuario autenticado y con rol admin, cargar datos iniciales
    loadReportData('current')
    loadCronStatus()
  }, [session, status, router])

  // Cargar datos del reporte
  const loadReportData = useCallback(async (type: string, params?: any) => {
    if (status !== 'authenticated') return
    
    setLoading(true)
    setError('')
    
    try {
      let url = `/api/admin/execution-report?type=${type}`
      if (params?.aula) url += `&aula=${params.aula}`
      if (params?.days) url += `&days=${params.days}`
      
      const response = await fetch(url, {
        credentials: 'include' // Incluir cookies de sesión
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('🔍 API Response:', data) // Debug log
        console.log('🔍 cronSchedule received:', data.cronSchedule) // Específico para cronSchedule
        setReportData(data)
      } else if (response.status === 401) {
        // Sesión expiró, redirigir al login
        router.push('/admin/login?error=session_expired')
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Error cargando datos')
      }
    } catch (err) {
      setError('Error de conexión')
      console.error('Error loading report:', err)
    } finally {
      setLoading(false)
    }
  }, [status, router])

  // Auto-refresh cada 30 segundos
  useEffect(() => {
    if (!autoRefresh || status !== 'authenticated') return
    
    const interval = setInterval(() => {
      loadReportData('current')
      loadCronStatus()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [autoRefresh, status, loadReportData])

  // Cargar datos específicos del modal
  const loadModalData = useCallback(async (type: 'aulas' | 'cursos' | 'actividades', page: number = 1) => {
    if (status !== 'authenticated') return
    
    setModalLoading(true)
    if (page === 1) setModalData(null) // Solo limpiar en la primera página
    
    try {
      const url = `/api/admin/execution-report?type=${type}-details&page=${page}&pageSize=${type === 'actividades' ? 100 : 50}`
      console.log('🔍 Loading modal data from:', url)
      
      const response = await fetch(url, {
        credentials: 'include'
      })
      
      console.log('🔍 Response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('🔍 Modal data received:', data)
        console.log('🔍 Data keys:', Object.keys(data))
        
        // Validar que tenemos datos antes de setearlos
        if (data && Object.keys(data).length > 0) {
          if (page === 1) {
            setModalData(data)
          } else {
            // Para páginas adicionales, devolver los datos sin actualizar el state principal
            return data
          }
        } else {
          console.log('🔍 Received empty data object:', data)
          if (page === 1) {
            setModalData({ empty: true, message: 'No hay datos disponibles para mostrar' })
          }
        }
      } else if (response.status === 401) {
        console.log('🔍 Unauthorized, redirecting to login')
        router.push('/admin/login?error=session_expired')
      } else {
        const errorData = await response.json()
        console.error('🔍 Error loading modal data:', response.status, errorData)
        if (page === 1) {
          setModalData({ error: true, message: errorData.message || `Error ${response.status}` })
        }
      }
    } catch (err) {
      console.error('🔍 Error loading modal data:', err)
      if (page === 1) {
        setModalData({ error: true, message: 'Error de conexión al cargar datos' })
      }
    } finally {
      setModalLoading(false)
    }
  }, [status, router])

  // Función para cargar más datos en el modal (scroll infinito)
  const handleLoadMore = useCallback(async (type: string, nextPage: number) => {
    if (status !== 'authenticated') return null
    
    console.log(`🔍 Loading more ${type} data, page ${nextPage}`)
    
    try {
      const url = `/api/admin/execution-report?type=${type}-details&page=${nextPage}&pageSize=${type === 'actividades' ? 100 : 50}`
      console.log('🔍 Loading additional modal data from:', url)
      
      const response = await fetch(url, {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('🔍 Additional data received:', { 
          page: nextPage,
          items: data[type === 'cursos' ? 'todosLosCursos' : 'todasLasActividades']?.length 
        })
        return data
      } else {
        console.error('🔍 Error loading additional data:', response.status)
        return null
      }
    } catch (err) {
      console.error('🔍 Error loading additional data:', err)
      return null
    }
  }, [status])

  // Manejar clic en tarjetas para abrir modal
  const handleCardClick = (type: 'aulas' | 'cursos' | 'actividades') => {
    setShowDetailsModal(type)
    loadModalData(type)
  }

  // Cargar estado del cron
  const loadCronStatus = useCallback(async () => {
    if (status !== 'authenticated') return
    
    try {
      const response = await fetch('/api/admin/execution-report?type=cron-verification', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setCronStatus(data)
      }
    } catch (err) {
      console.error('Error loading cron status:', err)
    }
  }, [status])

  // Verificar ejecución del cron
  const verifyCronExecution = async () => {
    await loadCronStatus()
    alert(`Estado del cron actualizado. Revisa la sección de estado del cron.`)
  }


  // Mostrar loading mientras verifica autenticación
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Verificando autenticación...</p>
        </div>
      </div>
    )
  }

  // Si no está autenticado o no es admin, el useEffect ya redirigió
  if (status !== 'authenticated' || session?.user?.role !== 'admin') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📊 Dashboard de Administración</h1>
            <p className="text-gray-600">
              Monitoreo de procesos batch • Bienvenido, {session.user.name || session.user.username}
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              className={`px-3 py-1 text-sm rounded ${
                autoRefresh 
                ? 'bg-blue-600 text-white' 
                : 'bg-white border border-gray-300 text-gray-700'
              }`}
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? '⏸️ Pausar' : '▶️ Auto-refresh'}
            </button>
            
            <button
              onClick={() => loadReportData('current')}
              disabled={loading}
              className="px-3 py-1 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:bg-gray-200"
            >
              🔄 Actualizar
            </button>

            <button
              onClick={verifyCronExecution}
              className="px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700"
              title="Verificar ejecución del cron de las 6:20 PM"
            >
              🔍 Verificar Cron
            </button>
            
            <button
              onClick={() => signOut({ callbackUrl: '/admin/login' })}
              className="px-3 py-1 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
            >
              🚪 Salir
            </button>
          </div>
        </div>

        {/* ESTADO PRINCIPAL DEL SISTEMA */}
        {cronStatus && reportData && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Estado del Sistema de Procesamiento</h2>
            
            {/* Comparación: Programado vs Real */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              
              {/* PROGRAMADO */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                  📅 Horario Programado
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-blue-700">Próxima ejecución:</span>
                    <span className="font-semibold text-blue-900">
                      {reportData.cronSchedule?.nextExecutionLocal || 'Calculando...'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-blue-700">Tipo:</span>
                    <span className="text-blue-800">
                      {reportData.cronSchedule?.nextExecutionType === 'morning' ? '🌅 8:00 AM' : '🌆 6:20 PM'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-blue-700">En:</span>
                    <span className="text-blue-800">{reportData.cronSchedule?.hoursUntilNext}h</span>
                  </div>
                </div>
              </div>

              {/* REAL */}
              <div className={`border rounded-lg p-6 ${
                cronStatus.totalActividades > 0 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${
                  cronStatus.totalActividades > 0 ? 'text-green-900' : 'text-red-900'
                }`}>
                  {cronStatus.totalActividades > 0 ? '✅' : '❌'} Estado Real
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className={cronStatus.totalActividades > 0 ? 'text-green-700' : 'text-red-700'}>
                      Actividades hoy:
                    </span>
                    <span className={`font-bold text-2xl ${
                      cronStatus.totalActividades > 0 ? 'text-green-900' : 'text-red-900'
                    }`}>
                      {cronStatus.totalActividades}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={cronStatus.actividadesTarde > 0 ? 'text-green-700' : 'text-red-700'}>
                      Ejecución 6:20 PM:
                    </span>
                    <span className={`font-bold ${
                      cronStatus.actividadesTarde > 0 ? 'text-green-900' : 'text-red-900'
                    }`}>
                      {cronStatus.actividadesTarde > 0 ? '✅ Ejecutada' : '❌ No ejecutada'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={cronStatus.totalActividades > 0 ? 'text-green-700' : 'text-red-700'}>
                      Última actividad:
                    </span>
                    <span className={`text-sm ${
                      cronStatus.totalActividades > 0 ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {cronStatus.ultimasActividades.length > 0 
                        ? new Date(cronStatus.ultimasActividades[0].updatedAt).toLocaleDateString('es-MX')
                        : 'Sin datos'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Alerta cuando no hay ejecución */}
            {cronStatus.totalActividades === 0 && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      <strong>⚠️ ATENCIÓN:</strong> El sistema está programado para ejecutarse automáticamente, 
                      pero no se han detectado procesamientos hoy. La última actividad real fue el{' '}
                      <strong>
                        {cronStatus.ultimasActividades.length > 0 
                          ? new Date(cronStatus.ultimasActividades[0].updatedAt).toLocaleDateString('es-MX')
                          : 'fecha desconocida'
                        }
                      </strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* RESUMEN DE DATOS */}
        {reportData && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Resumen del Sistema</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div 
                className="bg-white p-4 rounded-lg shadow border hover:shadow-md cursor-pointer transition-shadow"
                onClick={() => handleCardClick('aulas')}
              >
                <div className="text-2xl font-bold text-blue-600">{reportData.systemInfo.totalAulas}</div>
                <div className="text-sm text-gray-600">Aulas Configuradas</div>
              </div>
              
              <div 
                className="bg-white p-4 rounded-lg shadow border hover:shadow-md cursor-pointer transition-shadow"
                onClick={() => handleCardClick('cursos')}
              >
                <div className="text-2xl font-bold text-green-600">{reportData.systemInfo.totalCourses}</div>
                <div className="text-sm text-gray-600">Cursos Registrados</div>
              </div>
              
              <div 
                className="bg-white p-4 rounded-lg shadow border hover:shadow-md cursor-pointer transition-shadow"
                onClick={() => handleCardClick('actividades')}
              >
                <div className="text-2xl font-bold text-purple-600">
                  {reportData.systemInfo.totalActivities.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Actividades Totales</div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow border">
                <div className={`text-2xl font-bold ${
                  reportData.currentStatus?.isRunning ? 'text-green-600' : 'text-gray-400'
                }`}>
                  {reportData.currentStatus?.isRunning ? '🟢' : '⏸️'}
                </div>
                <div className="text-sm text-gray-600">
                  {reportData.currentStatus?.isRunning ? 'Procesando' : 'En Reposo'}
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'current', label: '🟢 Estado Actual' },
                { id: 'historical', label: '📈 Historial' },
                { id: 'detailed', label: '🔍 Detallado' },
                { id: 'analytics', label: '📊 Analytics' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id)
                    if (tab.id === 'current') loadReportData('current')
                    if (tab.id === 'historical') loadReportData('historical', { days: 7 })
                    if (tab.id === 'analytics') loadReportData('analytics')
                  }}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-4">
          {activeTab === 'current' && reportData?.currentStatus && (
            <CurrentStatusView 
              currentStatus={reportData.currentStatus}
              execution={reportData.execution}
              cronSchedule={reportData.cronSchedule}
            />
          )}

          {activeTab === 'historical' && reportData?.dailyStats && (
            <HistoricalView data={reportData} />
          )}

          {activeTab === 'detailed' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  placeholder="ID de aula (ej: 101, av141)"
                  value={selectedAula}
                  onChange={(e) => setSelectedAula(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md flex-1"
                />
                <button 
                  onClick={() => selectedAula && loadReportData('detailed', { aula: selectedAula })}
                  disabled={!selectedAula}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                >
                  Consultar
                </button>
              </div>
              
              {reportData?.aulaInfo && <DetailedView data={reportData} />}
            </div>
          )}

          {activeTab === 'analytics' && reportData?.errorAnalysis && (
            <AnalyticsView data={reportData} />
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Cargando...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mt-4">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Footer */}
        {reportData && (
          <div className="mt-6 text-center text-sm text-gray-500">
            Última actualización: {new Date(reportData.timestamp).toLocaleString('es-MX')} • 
            Consulta generada en {reportData.queryTime}ms • 
            Timezone: {reportData.systemInfo.systemTimezone}
          </div>
        )}
      </div>

      {/* Modal de detalles */}
      <DetailsModal 
        show={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(null)
          setModalData(null)
        }}
        data={modalData}
        loading={modalLoading}
        onLoadMore={handleLoadMore}
      />
    </div>
  )
}

// Componente para estado actual
function CurrentStatusView({ currentStatus, execution, cronSchedule }: { currentStatus: any, execution: any, cronSchedule?: CronSchedule }) {
  const isRunning = currentStatus.isRunning
  const lastActivity = currentStatus.lastActivity
  
  return (
    <div className="space-y-4">
      {/* Estado principal */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          {isRunning ? '🟢' : '⏸️'} Estado del Proceso
          {isRunning && (
            <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
              En ejecución
            </span>
          )}
        </h3>
        <p className="text-gray-600 mb-4">
          {isRunning 
            ? `Procesando... Última actividad hace ${currentStatus.minutesSinceLastUpdate} minutos`
            : 'Sistema en reposo'
          }
        </p>
        
        {lastActivity && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="font-medium">Última Actividad</p>
              <p>{lastActivity.name}</p>
              <p className="text-gray-500">Aula {lastActivity.aulaId}</p>
            </div>
            <div>
              <p className="font-medium">Tipo</p>
              <p>{lastActivity.type}</p>
            </div>
            <div>
              <p className="font-medium">Curso ID</p>
              <p>{lastActivity.courseId}</p>
            </div>
            <div>
              <p className="font-medium">Timestamp</p>
              <p>{new Date(lastActivity.updatedAt).toLocaleString('es-MX')}</p>
            </div>
          </div>
        )}
        
        {currentStatus.estimatedEndTime && (
          <div className="mt-4">
            <p className="text-sm font-medium">Finalización estimada:</p>
            <p className="text-sm text-gray-600">
              {new Date(currentStatus.estimatedEndTime).toLocaleString('es-MX')}
            </p>
          </div>
        )}
      </div>


      {/* Progreso por aula */}
      {execution?.aulaProgress && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">📊 Progreso por Aula</h3>
          <p className="text-gray-600 mb-4">
            {execution.totalStats?.aulas_procesadas || 0} de {execution.systemInfo?.totalAulas || 11} aulas procesadas
          </p>
          
          <div className="space-y-3">
            {execution.aulaProgress.map((aula: any, idx: number) => (
              <div key={aula.aulaId} className="flex items-center justify-between p-3 border rounded">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Aula {aula.aulaId}</span>
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                      {aula.cursos_procesados} cursos
                    </span>
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                      {aula.actividades_procesadas} actividades
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {aula.duracion_minutos} minutos • {aula.tipos_actividad} tipos
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p>{new Date(aula.inicio_procesamiento).toLocaleTimeString('es-MX')}</p>
                  <p className="text-gray-500">
                    → {new Date(aula.fin_procesamiento).toLocaleTimeString('es-MX')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Componente para vista histórica
function HistoricalView({ data }: { data: any }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">📈 Estadísticas por Día</h3>
      <div className="space-y-2">
        {data.dailyStats?.map((day: any, idx: number) => (
          <div key={idx} className="flex justify-between items-center p-2 border-b">
            <div>
              <p className="font-medium">{new Date(day.date).toLocaleDateString('es-MX')}</p>
              <p className="text-sm text-gray-500">{day.duracion_horas}h de duración</p>
            </div>
            <div className="text-right">
              <p>{day.aulas_procesadas} aulas</p>
              <p className="text-sm text-gray-500">
                {day.cursos_procesados} cursos, {day.actividades_procesadas} actividades
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Componente para vista detallada
function DetailedView({ data }: { data: any }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">🔍 Detalle de Aula {data.aulaInfo?.aulaId}</h3>
      
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="font-medium">Total Cursos</p>
          <p className="text-2xl font-bold">{data.summary?.totalCourses}</p>
        </div>
        <div>
          <p className="font-medium">Total Actividades</p>
          <p className="text-2xl font-bold">{data.summary?.totalActivities}</p>
        </div>
        <div>
          <p className="font-medium">Actividad Reciente</p>
          <p className="text-2xl font-bold">{data.summary?.recentActivityCount}</p>
        </div>
      </div>
      
      {/* Actividad reciente */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        <h4 className="font-medium">Actividades Recientes:</h4>
        {data.recentActivity?.map((activity: any, idx: number) => (
          <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
            <div>
              <p className="font-medium">{activity.name}</p>
              <p className="text-sm text-gray-500">
                Curso {activity.courseId} • {activity.type}
              </p>
            </div>
            <div className="text-right text-sm">
              <p>{new Date(activity.updatedAt).toLocaleDateString('es-MX')}</p>
              <p className="text-gray-500">
                {new Date(activity.updatedAt).toLocaleTimeString('es-MX')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Componente para analytics
function AnalyticsView({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      {/* Análisis de errores */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">⚠️ Análisis de Problemas</h3>
        <div className="space-y-2">
          {data.errorAnalysis?.map((aula: any, idx: number) => (
            <div 
              key={idx} 
              className={`p-3 rounded border ${
                aula.dias_sin_actualizar > 7 ? 'bg-red-50 border-red-200' : 
                aula.dias_sin_actualizar > 1 ? 'bg-yellow-50 border-yellow-200' :
                'bg-green-50 border-green-200'
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">Aula {aula.aulaId}</p>
                  <p className="text-sm text-gray-600">{aula.cursos_registrados} cursos registrados</p>
                </div>
                <div>
                  <span className={`px-2 py-1 text-xs rounded ${
                    aula.dias_sin_actualizar > 7 ? 'bg-red-100 text-red-800' :
                    aula.dias_sin_actualizar > 1 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {aula.dias_sin_actualizar} días sin actualizar
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Métricas de rendimiento */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">📊 Métricas de Rendimiento</h3>
        <div className="space-y-4">
          {data.performanceMetrics?.map((metric: any, idx: number) => (
            <div key={idx} className="grid grid-cols-5 gap-4 p-3 bg-gray-50 rounded">
              <div>
                <p className="font-medium">{metric.period}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Aulas</p>
                <p className="font-bold">{metric.aulas_activas}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Cursos</p>
                <p className="font-bold">{metric.cursos_procesados}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Actividades</p>
                <p className="font-bold">{metric.actividades_procesadas}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Act/Aula</p>
                <p className="font-bold">{metric.actividades_por_aula}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
    </div>
  )
}