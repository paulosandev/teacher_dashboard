'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface DetailsModalProps {
  show: string | null
  onClose: () => void
  data?: any
  loading?: boolean
  onLoadMore?: (type: string, nextPage: number) => Promise<any>
}

export default function DetailsModal({ show, onClose, data, loading, onLoadMore }: DetailsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (show) {
      dialog.showModal()
    } else {
      dialog.close()
    }

    // Event listener para cerrar al hacer click en el backdrop
    const handleClick = (e: MouseEvent) => {
      if (e.target === dialog) {
        onClose()
      }
    }

    dialog.addEventListener('click', handleClick)
    return () => dialog.removeEventListener('click', handleClick)
  }, [show, onClose])

  if (!show) return null

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Cargando datos...</span>
        </div>
      )
    }

    if (!data) {
      return (
        <div className="text-center py-8 text-gray-500">
          No hay datos disponibles
        </div>
      )
    }

    if (data.error) {
      return (
        <div className="text-center py-8 text-red-500">
          <div className="text-lg font-medium mb-2">Error al cargar datos</div>
          <div className="text-sm">{data.message || 'Error desconocido'}</div>
        </div>
      )
    }

    if (data.empty) {
      return (
        <div className="text-center py-8 text-yellow-600">
          <div className="text-lg font-medium mb-2">Sin datos</div>
          <div className="text-sm">{data.message || 'No hay datos disponibles para mostrar'}</div>
        </div>
      )
    }

    switch (show) {
      case 'aulas':
        return <AulasContent data={data} />
      case 'cursos':
        return <CursosContent data={data} onLoadMore={onLoadMore} />
      case 'actividades':
        return <ActividadesContent data={data} onLoadMore={onLoadMore} />
      default:
        return <div>Tipo de contenido no reconocido</div>
    }
  }

  return (
    <dialog 
      ref={dialogRef}
      className="backdrop:bg-black backdrop:bg-opacity-75 bg-transparent p-0 rounded-lg"
      onClose={onClose}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-auto max-h-[90vh] overflow-hidden">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {show === 'aulas' && '🏫 Detalles de Aulas Activas'}
              {show === 'cursos' && '📚 Detalles de Cursos Registrados'}
              {show === 'actividades' && '📝 Detalles de Actividades Totales'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl"
            >
              ✕
            </button>
          </div>
          
          <div className="mt-4 overflow-y-auto max-h-[70vh]">
            {renderContent()}
          </div>
        </div>
        
        <div className="bg-gray-50 px-6 py-3 flex justify-end border-t">
          <button
            type="button"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </dialog>
  )
}

// Componente para mostrar detalles de aulas
function AulasContent({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-900">{data.totalAulas}</div>
          <div className="text-sm text-blue-600">Total Aulas</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-900">{data.aulasActivas}</div>
          <div className="text-sm text-green-600">Aulas Activas</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-purple-900">
            {Math.round((data.aulasActivas / data.totalAulas) * 100)}%
          </div>
          <div className="text-sm text-purple-600">Actividad</div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium text-gray-900">Lista de Aulas</h4>
        <div className="grid gap-2 max-h-96 overflow-y-auto">
          {data.aulas?.map((aula: any) => (
            <div 
              key={aula.aulaId} 
              className={`p-3 rounded border ${
                aula.diasSinActividad <= 1 ? 'bg-green-50 border-green-200' :
                aula.diasSinActividad <= 7 ? 'bg-yellow-50 border-yellow-200' :
                'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">Aula {aula.aulaId}</div>
                  <div className="text-sm text-gray-600">
                    {aula._count.courses} cursos • {aula._count.activities} actividades
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm">
                    {aula.actividades7d > 0 ? (
                      <span className="text-green-600">{aula.actividades7d} act. (7d)</span>
                    ) : (
                      <span className="text-red-600">{aula.diasSinActividad}d sin actividad</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {aula.ultimaActividad && new Date(aula.ultimaActividad).toLocaleDateString('es-MX')}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Componente para mostrar detalles de cursos
function CursosContent({ data, onLoadMore }: { data: any; onLoadMore?: (type: string, nextPage: number) => Promise<any> }) {
  const [allCursos, setAllCursos] = useState(data.todosLosCursos || [])
  const [currentData, setCurrentData] = useState(data)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  
  const stats = currentData.estadisticasAvanzadas || {}
  const paginacion = currentData.paginacion || {}

  // Inicializar datos solo una vez
  useEffect(() => {
    if (!initialized && data && data.todosLosCursos) {
      console.log('🔄 Initializing cursos data...', data.todosLosCursos.length)
      setAllCursos(data.todosLosCursos)
      setCurrentData(data)
      setInitialized(true)
    }
  }, [data, initialized])

  const loadMoreData = useCallback(async () => {
    if (!onLoadMore || !paginacion.tieneProximaPagina || isLoadingMore) return
    
    console.log('🔄 Loading more cursos...', { 
      currentPage: paginacion.paginaActual, 
      hasNext: paginacion.tieneProximaPagina,
      currentCount: allCursos.length 
    })
    
    setIsLoadingMore(true)
    try {
      const nextPage = (paginacion.paginaActual || 1) + 1
      const newData = await onLoadMore('cursos', nextPage)
      
      if (newData && newData.todosLosCursos) {
        setAllCursos(prev => [...prev, ...newData.todosLosCursos])
        setCurrentData(prevData => ({
          ...prevData,
          paginacion: newData.paginacion || prevData.paginacion
        }))
        console.log('✅ More cursos loaded:', { 
          newItems: newData.todosLosCursos.length,
          totalNow: allCursos.length + newData.todosLosCursos.length
        })
      }
    } catch (error) {
      console.error('Error loading more cursos:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }, [onLoadMore, paginacion, isLoadingMore, allCursos.length])

  // Detectar scroll para carga automática
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 50 // 50px antes del final
    
    if (isNearBottom && !isLoadingMore && paginacion.tieneProximaPagina) {
      loadMoreData()
    }
  }, [loadMoreData, isLoadingMore, paginacion.tieneProximaPagina])

  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return

    scrollElement.addEventListener('scroll', handleScroll)
    return () => scrollElement.removeEventListener('scroll', handleScroll)
  }, [handleScroll])
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-900">{data.totalCursos?.toLocaleString() || 0}</div>
          <div className="text-sm text-blue-600">Total Cursos</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-900">{data.cursosConActividad7d || 0}</div>
          <div className="text-sm text-green-600">Activos (7d)</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-purple-900">{data.cursosActivos || 0}</div>
          <div className="text-sm text-purple-600">Con Actividad</div>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-orange-900">
            {stats.porcentajeActividad7d || 0}%
          </div>
          <div className="text-sm text-orange-600">% Actividad</div>
        </div>
      </div>

      {/* Información de paginación */}
      {paginacion.totalRegistros > 0 && (
        <div className="bg-gray-100 p-3 rounded-lg text-sm text-gray-600 text-center">
          Mostrando {allCursos.length} de {paginacion.totalRegistros?.toLocaleString()} cursos
          {paginacion.tieneProximaPagina && (
            <span className="block mt-1 text-blue-600">
              📜 Desliza hacia abajo para cargar más automáticamente
            </span>
          )}
        </div>
      )}

      {/* Lista completa de TODOS los cursos con scroll infinito */}
      <div>
        <h4 className="font-medium text-gray-900 mb-2">
          📋 Todos los Cursos ({allCursos.length} {allCursos.length !== paginacion.totalRegistros ? `de ${paginacion.totalRegistros?.toLocaleString()}` : 'cargados'})
        </h4>
        <div ref={scrollRef} className="space-y-2 max-h-96 overflow-y-auto">
          {allCursos.map((curso: any, idx: number) => (
            <div key={`${curso.aulaId}-${curso.courseId}`} className={`p-3 rounded border ${
              curso.estado === 'Activo' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {curso.courseName}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {curso.aulaName} • Curso ID: {curso.courseId}
                    {curso.shortName && ` • ${curso.shortName}`}
                  </div>
                  {curso.categoryName && (
                    <div className="text-xs text-gray-500 mt-1">
                      📂 {curso.categoryName}
                    </div>
                  )}
                </div>
                <div className="text-right ml-4">
                  <div className="text-sm">
                    <span className={`font-medium ${
                      curso.estado === 'Activo' ? 'text-green-600' : 'text-gray-600'
                    }`}>
                      {curso.estado}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {curso.totalActividades} actividades
                  </div>
                  <div className="text-xs text-gray-500">
                    {curso.actividadesUltimos7Dias > 0 ? 
                      `${curso.actividadesUltimos7Dias} últimos 7d` : 
                      'Sin actividad reciente'
                    }
                  </div>
                  {curso.enrollmentCount > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      👥 {curso.enrollmentCount} estudiantes
                    </div>
                  )}
                  {curso.ultimaActividad && (
                    <div className="text-xs text-gray-400 mt-1">
                      Última: {new Date(curso.ultimaActividad).toLocaleDateString('es-MX')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {/* Indicador de carga al final de la lista */}
          {isLoadingMore && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-gray-600">Cargando más cursos...</span>
            </div>
          )}
          
          {/* Mensaje cuando no hay más datos */}
          {!paginacion.tieneProximaPagina && allCursos.length > 0 && (
            <div className="text-center py-3 text-sm text-gray-500 border-t">
              📋 Has visto todos los {allCursos.length} cursos disponibles
            </div>
          )}
        </div>
      </div>

      {/* Resumen por aula */}
      {data.cursosPorAula && data.cursosPorAula.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-2">📊 Resumen por Aula</h4>
          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
            {data.cursosPorAula.slice(0, 10).map((aula: any) => (
              <div key={aula.aulaId} className="p-2 bg-blue-50 rounded text-sm">
                <div className="font-medium">{aula.aulaName}</div>
                <div className="text-xs text-gray-600">{aula.totalCursos} cursos</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Componente para mostrar detalles de actividades
function ActividadesContent({ data, onLoadMore }: { data: any; onLoadMore?: (type: string, nextPage: number) => Promise<any> }) {
  const [allActividades, setAllActividades] = useState([])
  const [currentData, setCurrentData] = useState(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const initializedRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  
  const stats = (currentData || data)?.estadisticas || {}
  const paginacion = (currentData || data)?.paginacion || {}

  // Inicializar datos solo la primera vez
  useEffect(() => {
    if (!initializedRef.current && data && data.todasLasActividades) {
      console.log('🔄 Initializing actividades data...', data.todasLasActividades.length)
      setAllActividades(data.todasLasActividades)
      setCurrentData(data)
      initializedRef.current = true
    }
  }, [data])

  // Reset cuando se cambia el modal o se cierra
  useEffect(() => {
    // Reset completo cuando se abre un nuevo modal
    initializedRef.current = false
    setAllActividades([])
    setCurrentData(null)
    setIsLoadingMore(false)
  }, [data?.timestamp]) // Usar timestamp para detectar nueva carga

  const loadMoreData = useCallback(async () => {
    if (!onLoadMore || !paginacion.tieneProximaPagina || isLoadingMore) return
    
    console.log('🔄 Loading more actividades...', { 
      currentPage: paginacion.paginaActual, 
      hasNext: paginacion.tieneProximaPagina,
      currentCount: allActividades.length
    })
    
    setIsLoadingMore(true)
    try {
      const nextPage = (paginacion.paginaActual || 1) + 1
      const newData = await onLoadMore('actividades', nextPage)
      
      if (newData && newData.todasLasActividades && newData.todasLasActividades.length > 0) {
        console.log('✅ Appending new actividades:', newData.todasLasActividades.length)
        
        // Solo actualizar los datos, sin tocar scroll
        setAllActividades(prev => [...prev, ...newData.todasLasActividades])
        setCurrentData(prevData => ({
          ...(prevData || {}),
          paginacion: newData.paginacion
        }))
      }
    } catch (error) {
      console.error('❌ Error loading more actividades:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }, [onLoadMore, paginacion, isLoadingMore, allActividades.length])

  // Detectar scroll para carga automática con throttle
  const lastScrollTrigger = useRef(0)
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || isLoadingMore) return
    
    const now = Date.now()
    if (now - lastScrollTrigger.current < 500) return // Throttle 500ms
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight
    const isNearBottom = scrollPercentage >= 0.9 // 90% del scroll
    
    if (isNearBottom && !isLoadingMore && paginacion.tieneProximaPagina) {
      console.log('🚀 Triggering load more actividades...', { percentage: Math.round(scrollPercentage * 100) + '%' })
      lastScrollTrigger.current = now
      loadMoreData()
    }
  }, [loadMoreData, isLoadingMore, paginacion.tieneProximaPagina])

  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return

    scrollElement.addEventListener('scroll', handleScroll)
    return () => scrollElement.removeEventListener('scroll', handleScroll)
  }, [handleScroll])
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-900">
            {stats.total_actividades?.toLocaleString() || 0}
          </div>
          <div className="text-sm text-blue-600">Total</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-900">{stats.actividades_7d || 0}</div>
          <div className="text-sm text-green-600">7 días</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-purple-900">{stats.actividades_24h || 0}</div>
          <div className="text-sm text-purple-600">24 horas</div>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-orange-900">{stats.tipos_actividad || 0}</div>
          <div className="text-sm text-orange-600">Tipos</div>
        </div>
      </div>

      {/* Información de paginación */}
      {paginacion.totalRegistros > 0 && (
        <div className="bg-gray-100 p-3 rounded-lg text-sm text-gray-600 text-center">
          Mostrando {allActividades.length} de {paginacion.totalRegistros?.toLocaleString()} actividades
          {paginacion.tieneProximaPagina && (
            <span className="block mt-1 text-blue-600">
              📜 Desliza hacia abajo para cargar más automáticamente
            </span>
          )}
        </div>
      )}

      {/* Lista completa de TODAS las actividades con scroll infinito */}
      <div>
        <h4 className="font-medium text-gray-900 mb-2">
          📝 Todas las Actividades ({allActividades.length} {allActividades.length !== paginacion.totalRegistros ? `de ${paginacion.totalRegistros?.toLocaleString()}` : 'cargadas'})
        </h4>
        <div ref={scrollRef} className="space-y-2 max-h-96 overflow-y-auto">
          {allActividades.map((actividad: any, idx: number) => (
            <div key={`${actividad.aulaId}-${actividad.courseId}-${actividad.activityId}`} 
                 className={`p-3 rounded border ${
                   actividad.needsAnalysis ? 'bg-yellow-50 border-yellow-200' : 
                   actividad.visible ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                 }`}>
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {actividad.name || 'Sin nombre'}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {actividad.aulaName} • {actividad.courseName || `Curso ${actividad.courseId}`}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {actividad.type}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      actividad.estado === 'Pendiente análisis' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {actividad.estado}
                    </span>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className="text-xs text-gray-500">
                    {actividad.tiempoTranscurrido} ago
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(actividad.updatedAt).toLocaleDateString('es-MX')}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(actividad.updatedAt).toLocaleTimeString('es-MX', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                  {actividad.dueDate && (
                    <div className="text-xs text-red-500 mt-1">
                      ⏰ Vence: {new Date(actividad.dueDate).toLocaleDateString('es-MX')}
                    </div>
                  )}
                </div>
              </div>
              
              {actividad.description && (
                <div className="mt-2 text-xs text-gray-600 truncate">
                  📄 {actividad.description}
                </div>
              )}
            </div>
          ))}
          
          {/* Indicador de carga al final de la lista */}
          {isLoadingMore && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-gray-600">Cargando más actividades...</span>
            </div>
          )}
          
          {/* Mensaje cuando no hay más datos */}
          {!paginacion.tieneProximaPagina && allActividades.length > 0 && (
            <div className="text-center py-3 text-sm text-gray-500 border-t">
              📝 Has visto todas las {allActividades.length} actividades disponibles
            </div>
          )}
        </div>
      </div>

      {/* Tipos de actividad con estadísticas */}
      {data.tiposActividad && data.tiposActividad.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-2">📊 Análisis por Tipo</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {data.tiposActividad.map((tipo: any) => (
              <div key={tipo.type} className="p-2 bg-blue-50 rounded border border-blue-200">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-sm">{tipo.type}</div>
                    <div className="text-xs text-gray-600">
                      En {tipo.aulas_con_este_tipo} aulas • {tipo.porcentaje}% del total
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-blue-600">
                      {tipo.total.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      24h: {tipo.ultimos_24h} • 7d: {tipo.ultimos_7d}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resumen por aula */}
      {data.actividadesPorAula && data.actividadesPorAula.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-2">🏫 Top Aulas Más Activas</h4>
          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
            {data.actividadesPorAula.slice(0, 10).map((aula: any) => (
              <div key={aula.aulaId} className="p-2 bg-green-50 rounded text-sm">
                <div className="font-medium">{aula.aulaName}</div>
                <div className="text-xs text-gray-600">
                  {aula.totalActividades.toLocaleString()} actividades • {aula.porcentajeTotal}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}