'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faCheckCircle, 
  faExclamationTriangle, 
  faTimesCircle,
  faSpinner,
  faRefresh,
  faMagicWandSparkles,
  faChevronDown,
  faBrain,
  faRobot,
  faEye,
  faLightbulb,
  faArrowLeft,
  faExternalLinkAlt
} from '@fortawesome/free-solid-svg-icons'
import SimpleCourseSelector from '@/components/dashboard/simple-course-selector'
import { AnalysisModal } from '@/components/dashboard/analysis-modal'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ContentParser } from '@/components/ui/content-parser'
import { AnalysisList } from '@/components/ui/analysis-list'
import { DynamicSectionRenderer } from '@/components/ui/dynamic-section'

interface User {
  id: string
  name: string
  firstName: string
  matricula: string
}

interface Course {
  id: string
  name: string
  shortname?: string
  fullname?: string
  visible?: boolean
}

interface IntelligentDashboardContentProps {
  user: User
  courses: Course[]
  connectionStatus: 'connected' | 'disconnected' | 'failed' | 'error'
  error?: string | null
}

// Caché en memoria para mantener los datos de cursos visitados durante la sesión
interface CourseCache {
  activities: any[]
  analysisResults: {[key: string]: any}
  activitiesSummary: any
  lastFetched: number
  courseAnalysisId?: string
}

const courseDataCache: {[courseId: string]: CourseCache} = {}
const CACHE_DURATION = 60 * 60 * 1000 // 1 hora de caché

export function IntelligentDashboardContent({
  user,
  courses,
  connectionStatus,
  error
}: IntelligentDashboardContentProps) {
  const [mounted, setMounted] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null)
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false)
  const [analysisCards, setAnalysisCards] = useState<any[]>([])
  const [openActivities, setOpenActivities] = useState<any[]>([])
  const [loadingActivities, setLoadingActivities] = useState(false)
  const [activitiesSummary, setActivitiesSummary] = useState<any>(null)
  const [analysisResults, setAnalysisResults] = useState<{[key: string]: any}>({})
  const [analyzingActivity, setAnalyzingActivity] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null)
  const [selectedActivityName, setSelectedActivityName] = useState('')
  const [selectedActivityType, setSelectedActivityType] = useState('')
  const [visibleActivitiesCount, setVisibleActivitiesCount] = useState(50) // Número de actividades visibles - mostrar todas
  const [isAnalyzingBatch, setIsAnalyzingBatch] = useState(false)
  const [isLoadingCourse, setIsLoadingCourse] = useState(true) // Nuevo estado para loader general, empieza en true
  const [loadingPhase, setLoadingPhase] = useState<'loading' | 'analyzing' | 'cleaning'>('loading') // Fase actual de carga
  const [cacheLoaded, setCacheLoaded] = useState(false) // Estado para saber si el cache ya se cargó
  const [detailView, setDetailView] = useState<{isActive: boolean, activity: any} | null>(null) // Estado para vista de detalle
  const [courseAnalysisId, setCourseAnalysisId] = useState<string | null>(null) // ID del análisis del curso
  const [batchProgress, setBatchProgress] = useState<{current: number, total: number}>({current: 0, total: 0}) // Progreso del análisis batch
  const BATCH_SIZE = 5

  // Define functions before useEffect that references them
  
  // Función para guardar datos en caché persistente
  const saveToPersistentCache = useCallback(async (courseId: string, data: {
    activities: any[], 
    analysisResults: any, 
    activitiesSummary: any, 
    courseAnalysisId?: string
  }) => {
    try {
//       console.log('💾 Guardando datos en caché persistente para curso:', courseId)
      await fetch('/api/analysis/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          activities: data.activities,
          analysisResults: data.analysisResults,
          activitiesSummary: data.activitiesSummary,
          courseAnalysisId: data.courseAnalysisId
        })
      })
    } catch (error) {
      console.error('Error guardando caché persistente:', error)
    }
  }, [])

  const loadAnalysisForCourse = useCallback(async (courseId: string) => {
    try {
      // Cargar análisis existentes para este curso desde caché persistente
//       console.log(`🔍 Cargando análisis desde caché persistente para curso: ${courseId}`)
      const response = await fetch(`/api/analysis/cache?courseId=${courseId}`)
      
//       console.log(`📡 Respuesta de caché persistente: ${response.status}`)
      
      if (response.status === 401 || response.status === 403) {
        console.log('🔐 Sin autenticación para caché persistente, continuando sin caché')
        setAnalysisResults({})
        return false
      }
      
      if (response.ok) {
        const data = await response.json()
        console.log('📦 Datos recibidos del caché persistente:', data)
        
        if (data.success && data.analysisResults) {
          console.log(`📦 Cargados ${data.count} análisis desde caché persistente`)
          console.log(`⏰ Caché válido hasta: ${data.expiresAt}`)
          
          // Cargar todos los datos del caché persistente
          setAnalysisResults(data.analysisResults)
          if (data.activities) {
            setOpenActivities(data.activities)
//             console.log(`📋 Cargadas ${data.activities.length} actividades desde caché`)
          }
          if (data.activitiesSummary) {
            setActivitiesSummary(data.activitiesSummary)
          }
          if (data.courseAnalysisId) {
            setCourseAnalysisId(data.courseAnalysisId)
          }
          
          // También guardarlo en caché de memoria para acceso rápido
          courseDataCache[courseId] = {
            activities: data.activities || [],
            analysisResults: data.analysisResults,
            activitiesSummary: data.activitiesSummary,
            lastFetched: new Date(data.lastFetched).getTime(),
            courseAnalysisId: data.courseAnalysisId
          }
          
//           console.log('✅ Datos cargados desde caché persistente')
          return true // Indica que se cargaron datos del caché
        } else {
          console.log('⚠️ Respuesta exitosa pero sin datos válidos en caché persistente')
          setAnalysisResults({})
          return false
        }
      } else {
        console.log(`❌ Error en respuesta del caché persistente: ${response.status}`)
        const errorText = await response.text()
        console.log(`❌ Detalles del error: ${errorText}`)
        setAnalysisResults({})
        return false
      }
    } catch (error) {
      console.error('Error cargando análisis desde caché persistente:', error)
      setAnalysisResults({})
      return false
    } finally {
      setCacheLoaded(true)
      console.log('🏁 Cache loading completed')
    }
  }, [saveToPersistentCache])

  const loadOpenActivities = useCallback(async (courseId: string) => {
    try {
      setLoadingActivities(true)
//       console.log('🎯 Obteniendo actividades abiertas para curso:', courseId)
      
      const response = await fetch(`/api/activities/open?courseId=${courseId}`)
      if (response.ok) {
        const data = await response.json()
        setOpenActivities(data.activities || [])
        setActivitiesSummary(data.summary || null)
        console.log(`🟢 Actividades abiertas encontradas: ${data.activities?.length || 0}`)
      } else {
        console.log('❌ Error obteniendo actividades abiertas')
        setOpenActivities([])
        setActivitiesSummary(null)
      }
    } catch (error) {
      console.error('Error cargando actividades abiertas:', error)
      setOpenActivities([])
      setActivitiesSummary(null)
    } finally {
      setLoadingActivities(false)
    }
  }, [])

  // Función para generar reporte de debug del curso
  const generateDebugReport = useCallback(async (courseId: string) => {
    try {
      console.log(`🐛 Generando reporte de debug para curso: ${courseId}`)
      
      const response = await fetch('/api/debug/course-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseGroupId: courseId // El courseId ya está en formato "courseId|groupId"
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
//         console.log(`✅ Reporte de debug generado exitosamente: ${data.reportPath}`)
        console.log(`📄 ID del reporte: ${data.reportId}`)
      } else {
        console.error(`❌ Error generando reporte de debug:`, data.error)
      }

    } catch (error) {
      console.error('Error generando reporte de debug:', error)
    }
  }, [])

  // Efecto para actualización automática cada hora para usuarios activos
  useEffect(() => {
    const updateInterval = setInterval(() => {
      // Solo actualizar si el usuario está activo (pestaña visible)
      if (document.visibilityState === 'visible' && selectedCourse) {
        const cached = courseDataCache[selectedCourse]
        if (cached) {
          const now = Date.now()
          const timeSinceLastUpdate = now - cached.lastFetched
          
          // Si han pasado más de 50 minutos (un poco antes de que expire)
          if (timeSinceLastUpdate >= 50 * 60 * 1000) {
            console.log('🕐 Actualizando datos automáticamente por tiempo (1 hora):', selectedCourse)
            // Forzar actualización silenciosa
            delete courseDataCache[selectedCourse]
            setIsLoadingCourse(true)
            const loadData = async () => {
              try {
                setLoadingPhase('loading')
                await loadOpenActivities(selectedCourse)
                await loadAnalysisForCourse(selectedCourse)
                generateDebugReport(selectedCourse)
              } catch (error) {
                console.error('Error en actualización automática:', error)
              }
            }
            loadData()
          }
        }
      }
    }, 10 * 60 * 1000) // Verificar cada 10 minutos

    return () => clearInterval(updateInterval)
  }, [selectedCourse, loadOpenActivities, loadAnalysisForCourse, generateDebugReport])

  const handleCourseChange = useCallback(async (courseId: string) => {
    console.log('🎯 Cambiando a curso/grupo:', courseId)
    
    // IMPORTANTE: Limpiar estado INMEDIATAMENTE al cambiar de curso/grupo
    setOpenActivities([])
    setAnalysisResults({})
    setActivitiesSummary(null)
    setCourseAnalysisId(null)
    setCacheLoaded(false)
    setVisibleActivitiesCount(50)
    
    // Actualizar el curso seleccionado
    setSelectedCourse(courseId)
    
    // Verificar si tenemos datos en caché para este curso/grupo específico
    const cached = courseDataCache[courseId]
    const now = Date.now()
    
    if (cached && (now - cached.lastFetched) < CACHE_DURATION) {
      console.log('✅ Usando datos del caché en memoria para el curso/grupo:', courseId)
      // Restaurar datos desde el caché
      setOpenActivities(cached.activities)
      setAnalysisResults(cached.analysisResults)
      setActivitiesSummary(cached.activitiesSummary)
      if (cached.courseAnalysisId) {
        setCourseAnalysisId(cached.courseAnalysisId)
      }
      setIsLoadingCourse(false)
      setCacheLoaded(true)
    } else {
      console.log('🔄 No hay caché válido, se cargarán datos frescos para el curso/grupo:', courseId)
      setIsLoadingCourse(true)
      // Si no hay caché o expiró, el useEffect se encargará de cargar los datos
    }
  }, [])

  // Auto-selection removed - user must select manually

  // Cargar datos cuando cambie el curso seleccionado
  useEffect(() => {
    if (selectedCourse) {
      // 1. Verificar caché de memoria primero (más rápido)
      const cached = courseDataCache[selectedCourse]
      const now = Date.now()
      
      // Verificar que el caché corresponda exactamente al curso/grupo seleccionado
      if (cached && (now - cached.lastFetched) < CACHE_DURATION) {
        console.log('📦 Restaurando datos del caché de memoria para curso/grupo:', selectedCourse)
        // Usar datos del caché directamente
        setOpenActivities(cached.activities)
        setAnalysisResults(cached.analysisResults)
        setActivitiesSummary(cached.activitiesSummary)
        if (cached.courseAnalysisId) {
          setCourseAnalysisId(cached.courseAnalysisId)
        }
        setCacheLoaded(true)
        setIsLoadingCourse(false)
        setVisibleActivitiesCount(50)
        return // No cargar datos nuevos
      }
      
      // 2. Si no hay caché de memoria, intentar cargar desde caché persistente
//       console.log('🔍 No hay caché de memoria válido, intentando caché persistente...')
      setIsLoadingCourse(true)
      setVisibleActivitiesCount(50)
      
      const loadData = async () => {
        let hasPeristentCache = false
        
        try {
          setLoadingPhase('loading')
//           console.log('🔄 Fase: Verificando caché persistente...')
          
          // Intentar cargar desde caché persistente
          hasPeristentCache = await loadAnalysisForCourse(selectedCourse)
          
          if (hasPeristentCache) {
//             console.log('✅ Datos cargados desde caché persistente, finalizando carga')
            // El useEffect de análisis automático se encargará de desactivar el loader
            // cuando detecte que tenemos datos y cacheLoaded = true
            return
          }
          
          // 3. Si no hay caché persistente, cargar datos frescos
//           console.log('🔄 Fase: Cargando datos frescos del servidor...')
          setOpenActivities([])
          setAnalysisResults({})
          
          await loadOpenActivities(selectedCourse)
          // loadAnalysisForCourse ya se ejecutó arriba, solo necesitamos actividades
          // cacheLoaded ya está en true por el finally de loadAnalysisForCourse
          
          // El useEffect de análisis automático se encargará de desactivar el loader
          // cuando detecte que tenemos actividades y cacheLoaded = true
          
          // Generar reporte de debug automáticamente
          generateDebugReport(selectedCourse)
          
        } catch (error) {
          console.error('Error en loadData:', error)
          setIsLoadingCourse(false)
        }
        // No necesitamos finally aquí
      }
      
      loadData()
    }
  }, [selectedCourse, loadOpenActivities, loadAnalysisForCourse, generateDebugReport])

  // Función para verificar si un análisis está desactualizado (>4 horas)
  const isAnalysisOutdated = useCallback((analysis: any) => {
    if (!analysis?.generatedAt) return true
    
    const fourHoursInMs = 4 * 60 * 60 * 1000
    const analysisAge = Date.now() - new Date(analysis.generatedAt).getTime()
    
    return analysisAge > fourHoursInMs
  }, [])

  // Función para analizar una actividad individual con información extendida
  const analyzeActivity = useCallback(async (activity: any, showVisualFeedback = true) => {
//     console.log('🚀 INICIANDO analyzeActivity con:', { activity, showVisualFeedback })
    
    if (!activity) {
      console.error('❌ analyzeActivity: activity es null o undefined')
      alert('Error: No se proporcionó información de la actividad')
      return
    }
    
    if (!activity.id || !activity.type) {
      console.error('❌ analyzeActivity: activity no tiene id o type:', activity)
      alert('Error: La actividad no tiene ID o tipo válido')
      return
    }
    
    const activityKey = `${activity.type}_${activity.id}`
//     console.log('🔑 Activity key generada:', activityKey)
    
    try {
      // Solo mostrar estado de análisis si showVisualFeedback es true (análisis individual)
      if (showVisualFeedback) {
        setAnalyzingActivity(activityKey)
      }
      console.log(`🧠 Iniciando análisis de actividad: ${activity.name}`)
      
      const response = await fetch('/api/analysis/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: activity.id,
          activityType: activity.type,
          activityData: activity,
          includeDetailedInfo: true // Nuevo flag para incluir información extendida
        })
      })

//       console.log('📊 Response status:', response.status)
//       console.log('📊 Response headers:', response.headers)
      
      // Verificar si la respuesta es HTML (redirección a login)
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('text/html')) {
        console.error('❌ La sesión ha expirado - redirigiendo a login')
        if (showVisualFeedback) {
          alert('Su sesión ha expirado. Por favor, recargue la página e inicie sesión nuevamente.')
        }
        window.location.reload()
        return
      }
      
      const data = await response.json()
//       console.log('📊 Response data:', data)

      if (response.ok && data.success) {
        setAnalysisResults(prev => ({
          ...prev,
          [activityKey]: {
            ...data.analysis,
            rawActivityData: activity, // Guardar datos originales
            analysisPrompt: data.prompt, // Guardar prompt usado
            collectedData: data.collectedData // Guardar datos recopilados
          }
        }))
//         console.log(`✅ Análisis completado para: ${activity.name}`)
      } else {
        console.error('❌ Error en análisis:', data.error)
        if (showVisualFeedback) {
          alert(`Error: ${data.error || 'No se pudo generar el análisis'}`)
        }
      }

    } catch (error) {
      console.error('Error analizando actividad:', error)
      if (showVisualFeedback) {
        alert('Error generando análisis de la actividad')
      }
    } finally {
      if (showVisualFeedback) {
        setAnalyzingActivity(null)
      }
    }
  }, [])

  // Función para analizar las actividades visibles actuales
  const analyzeVisibleActivities = useCallback(async () => {
    if (!openActivities.length) return

    setIsAnalyzingBatch(true)
    // Analizar solo las actividades que están visibles actualmente
    const activitiesToAnalyze = openActivities.slice(0, visibleActivitiesCount)

    console.log(`📦 Analizando ${activitiesToAnalyze.length} actividades visibles`)
//     console.log(`📋 Análisis en cache disponibles: ${Object.keys(analysisResults).length}`)

    for (const activity of activitiesToAnalyze) {
      const activityKey = `${activity.type}_${activity.id}`
      const existingAnalysis = analysisResults[activityKey]
      
      if (!existingAnalysis) {
        console.log(`🆕 ${activity.name} - No hay análisis previo, generando...`)
        await analyzeActivity(activity, false)
      } else if (isAnalysisOutdated(existingAnalysis)) {
        console.log(`⏰ ${activity.name} - Análisis desactualizado, regenerando...`)
        await analyzeActivity(activity, false)
      } else {
//         console.log(`✅ ${activity.name} - Usando análisis en caché (${existingAnalysis.fromCache ? 'desde BD' : 'desde sesión'})`)
      }
    }

    setIsAnalyzingBatch(false)
  }, [openActivities, visibleActivitiesCount, analysisResults, isAnalysisOutdated, analyzeActivity])

  // Direct analysis functionality (removed queue-based approach)
  
  // Función para forzar actualización del curso/grupo actual
  const forceRefreshCurrentCourse = async () => {
    if (!selectedCourse || !openActivities.length) return
    
    const confirmed = confirm(
      `🧹 LIMPIEZA COMPLETA DEL SISTEMA\n\n¿Proceder con la actualización completa?\n\nEsto hará:\n• Limpiará TODA la base de datos\n• Limpiará TUTTO el caché Redis\n• Limpiará caché y cookies del navegador\n• Re-analizará todas las ${openActivities.length} actividades\n\n⚠️ Todos los análisis previos se perderán.`
    )
    
    if (!confirmed) return
    
    try {
      console.log(`🧹 INICIANDO LIMPIEZA COMPLETA DEL SISTEMA`)
      
      // 1. LIMPIEZA COMPLETA DEL SISTEMA
      setLoadingPhase('cleaning')
      console.log('🧹 Llamando endpoint de limpieza completa...')
      
      const clearResponse = await fetch('/api/analysis/clear-cache', {
        method: 'POST',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
      
      if (!clearResponse.ok) {
        throw new Error('Error en limpieza completa')
      }
      
      const clearResult = await clearResponse.json()
      console.log('✅ Limpieza completa exitosa:', clearResult)
      
      // 2. Limpiar caché local del componente
      Object.keys(courseDataCache).forEach(key => delete courseDataCache[key]) // Resetear completamente el caché
      setAnalysisResults({})
      
      // 3. Recargar página para limpiar estado completo
      console.log('🔄 Recargando página para estado completamente fresco...')
      window.location.href = window.location.pathname + '?refresh=' + Date.now()
      
    } catch (error) {
      console.error('❌ Error en limpieza completa:', error)
      setError('Error al actualizar análisis. Por favor intente nuevamente.')
      
      // Fallback: limpieza manual si falla la API
      try {
        delete courseDataCache[selectedCourse]
        setAnalysisResults({})
        
        // Configurar estado de análisis
        setIsAnalyzingBatch(true)
        setLoadingPhase('analyzing')
        setBatchProgress({current: 0, total: openActivities.length})
        
        // Analizar todas las actividades secuencialmente
        for (let i = 0; i < openActivities.length; i++) {
          const activity = openActivities[i]
          setBatchProgress({current: i + 1, total: openActivities.length})
          await analyzeActivity(activity, false)
        }
        
        await loadAnalysisForCourse(selectedCourse)
      } catch (fallbackError) {
        console.error('❌ Error en fallback:', fallbackError)
      } finally {
        setIsAnalyzingBatch(false)
        setLoadingPhase(null)
        setBatchProgress(null)
      }
    }
  }

  // Ejecutar análisis automático cuando se cargan las actividades Y el cache
  useEffect(() => {
    console.log('🔍 useEffect análisis automático - Estado:', {
      cacheLoaded,
      loadingActivities,
      selectedCourse: !!selectedCourse,
      isLoadingCourse,
      openActivitiesCount: openActivities.length,
      analysisCount: Object.keys(analysisResults).length
    })
    
    // Cambiar condición: permitir análisis cuando hay actividades sin análisis, independiente del estado de carga
    if (cacheLoaded && !loadingActivities && selectedCourse) {
      if (openActivities.length > 0 && !isAnalyzingBatch) {
        // Verificar si ya tenemos análisis para las actividades
        const hasAnalysisForActivities = openActivities.some(activity => {
          const activityKey = `${activity.type}_${activity.id}`
          return analysisResults[activityKey]
        })
        
        // Identificar actividades que NO tienen análisis
        const activitiesWithoutAnalysis = openActivities.filter(activity => {
          const activityKey = `${activity.type}_${activity.id}`
          return !analysisResults[activityKey]
        })
        
//         console.log(`📊 Estado del análisis: ${Object.keys(analysisResults).length} analizadas, ${activitiesWithoutAnalysis.length} sin analizar de ${openActivities.length} totales`)
        
        if (activitiesWithoutAnalysis.length > 0) {
          // Analizar directamente las actividades que faltan (como el botón individual)
          const startDirectAnalysisForMissing = async () => {
            setLoadingPhase('analyzing')
            setIsAnalyzingBatch(true)
            console.log(`🧠 Iniciando análisis directo de ${activitiesWithoutAnalysis.length} actividades sin analizar`)
            
            // Configurar progreso
            setBatchProgress({current: 0, total: activitiesWithoutAnalysis.length})
            
            // Analizar secuencialmente cada actividad que falta
            for (let i = 0; i < activitiesWithoutAnalysis.length; i++) {
              const activity = activitiesWithoutAnalysis[i]
//               console.log(`📊 Analizando actividad ${i + 1}/${activitiesWithoutAnalysis.length}: ${activity.name}`)
              
              // Actualizar progreso
              setBatchProgress({current: i + 1, total: activitiesWithoutAnalysis.length})
              
              // Usar la misma función que el botón individual
              await analyzeActivity(activity, false) // sin feedback visual individual
            }
            
            setIsAnalyzingBatch(false)
            setIsLoadingCourse(false)
            setBatchProgress({current: 0, total: 0}) // Limpiar progreso
//             console.log('✅ Análisis directo completado para todas las actividades faltantes')
          }
          startDirectAnalysisForMissing()
        } else {
          // Todas las actividades ya tienen análisis
//           console.log('✅ Todas las actividades ya tienen análisis, desactivando loader')
          setIsLoadingCourse(false)
        }
      } else if (Object.keys(analysisResults).length > 0) {
        // Caso 2: No hay actividades abiertas PERO hay análisis en cache - mostrar cache inmediatamente
        console.log('📦 Mostrando análisis desde cache sin actividades abiertas')
//         console.log(`📋 Análisis disponibles en cache: ${Object.keys(analysisResults).length}`)
        setIsLoadingCourse(false) // Desactivar loader y mostrar cache
      } else {
        // Caso 3: No hay actividades ni cache - desactivar loader
        console.log('🙅‍♂️ No hay actividades abiertas ni análisis en cache para este grupo')
        setIsLoadingCourse(false)
      }
    }
  }, [openActivities, cacheLoaded, isAnalyzingBatch, isLoadingCourse, loadingActivities, selectedCourse, analysisResults])
  
  // Queue polling removed - now using direct analysis approach

  // Timeout de seguridad para desactivar el loader si se queda atascado
  useEffect(() => {
    if (isLoadingCourse) {
      console.log('⏰ Iniciando timeout de seguridad para el loader (10 segundos)')
      const timeoutId = setTimeout(() => {
        console.log('🚨 Timeout de seguridad activado - desactivando loader forzosamente')
//         console.log('📊 Estado al momento del timeout:', {
//           cacheLoaded,
//           loadingActivities,
//           openActivitiesCount: openActivities.length,
//           analysisCount: Object.keys(analysisResults).length,
//           selectedCourse
//         })
        setIsLoadingCourse(false)
      }, 10000) // 10 segundos para test más rápido
      
      return () => {
        clearTimeout(timeoutId)
      }
    }
  }, [isLoadingCourse, cacheLoaded, loadingActivities, openActivities, analysisResults, selectedCourse])

  // Guardar datos en caché cuando se actualicen
  useEffect(() => {
    if (selectedCourse && !isLoadingCourse && !loadingActivities && cacheLoaded) {
      // Solo guardar en caché cuando tengamos datos completos
      if (openActivities.length > 0 || Object.keys(analysisResults).length > 0) {
//         console.log('💾 Guardando datos en caché de memoria y persistente para curso:', selectedCourse)
        
        // Guardar en caché de memoria
        courseDataCache[selectedCourse] = {
          activities: openActivities,
          analysisResults: analysisResults,
          activitiesSummary: activitiesSummary,
          lastFetched: Date.now(),
          courseAnalysisId: courseAnalysisId || undefined
        }
        
        // Guardar en caché persistente (base de datos)
        saveToPersistentCache(selectedCourse, {
          activities: openActivities,
          analysisResults: analysisResults,
          activitiesSummary: activitiesSummary,
          courseAnalysisId: courseAnalysisId || undefined
        })
      }
    }
  }, [selectedCourse, openActivities, analysisResults, activitiesSummary, isLoadingCourse, loadingActivities, cacheLoaded, courseAnalysisId, saveToPersistentCache])

  const generateNewAnalysis = useCallback(async () => {
    if (!selectedCourse) {
      console.error('❌ No hay curso seleccionado')
      return
    }

//     console.log('🚀 INICIANDO ANÁLISIS DE CURSO')
//     console.log('📋 Curso seleccionado:', selectedCourse)

    try {
      setIsGeneratingAnalysis(true)
      
      console.log('📤 Enviando solicitud a /api/analysis/generate-course-analysis')
      const response = await fetch('/api/analysis/generate-course-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourse
        })
      })

      console.log('📥 Respuesta recibida:', response.status, response.statusText)
      const data = await response.json()
//       console.log('📊 Datos de respuesta:', data)

      if (response.ok && data.success) {
//         console.log('✅ Análisis generado exitosamente')
//         console.log('🔄 Recargando análisis del curso...')
        await loadAnalysisForCourse(selectedCourse)
        
        // Navegar a la página de detalle del análisis del curso
        if (data.analysis?.id) {
          console.log('🔗 Navegando a análisis detalle:', data.analysis.id)
          window.open(`/dashboard/analysis/${data.analysis.id}`, '_blank')
        } else {
          console.warn('⚠️ No se recibió ID del análisis en la respuesta')
        }
      } else {
        console.error('❌ Error en respuesta del servidor:', data)
        alert(`Error: ${data.error || 'No se pudo generar el análisis'}`)
      }

    } catch (error) {
      console.error('❌ Error en catch generando análisis:', error)
      alert('Error generando análisis')
    } finally {
      setIsGeneratingAnalysis(false)
      console.log('🏁 Proceso de análisis finalizado')
    }
  }, [selectedCourse, loadAnalysisForCourse])

  // Función para cargar más actividades (acumulativo)
  const loadMoreActivities = useCallback(() => {
    const newVisibleCount = Math.min(visibleActivitiesCount + BATCH_SIZE, openActivities.length)
    setVisibleActivitiesCount(newVisibleCount)
//     console.log(`📋 Mostrando ${newVisibleCount} de ${openActivities.length} actividades`)
  }, [visibleActivitiesCount, openActivities.length])

  // Resetear actividades visibles cuando cambia el curso
  useEffect(() => {
    setVisibleActivitiesCount(50) // Mostrar todas las actividades disponibles al cambiar de curso
  }, [selectedCourse])

  // Función para obtener las actividades visibles (optimizada con useMemo)
  const getVisibleActivities = useMemo(() => {
    return openActivities.slice(0, visibleActivitiesCount)
  }, [openActivities, visibleActivitiesCount])
  
  // Calcular estadísticas (optimizado)
  const stats = useMemo(() => {
    return {
      visibleCount: visibleActivitiesCount,
      totalCount: openActivities.length,
      hasMore: visibleActivitiesCount < openActivities.length,
      remainingCount: openActivities.length - visibleActivitiesCount
    }
  }, [openActivities.length, visibleActivitiesCount])

  // FUNCIÓN DESHABILITADA - Ahora usamos análisis por lotes manual
  // const startAutomaticAnalysis = useCallback(async (activities: any[]) => {
  //   console.log('🤖 Iniciando análisis automático de actividades...')
  //   
  //   for (const activity of activities) {
  //     const activityKey = `${activity.type}_${activity.id}`
  //     
  //     // Solo analizar si no existe análisis previo o si es muy antiguo (>4 horas)
  //     const existingAnalysis = analysisResults[activityKey]
  //     const shouldAnalyze = !existingAnalysis || isAnalysisOutdated(existingAnalysis)
  //     
  //     if (shouldAnalyze) {
  //       // Pequeña pausa entre análisis para evitar sobrecarga
  //       await new Promise(resolve => setTimeout(resolve, 1000))
  //       await analyzeActivity(activity)
  //     }
  //   }
  // }, [analysisResults, analyzeActivity, isAnalysisOutdated])

  // DESHABILITADO: Análisis automático - ahora es manual por lotes
  // Los análisis se hacen solo cuando el usuario presiona el botón "Analizar Lote"

  // Función para crear extractos coherentes y específicos para cards
  const getAnalysisExtract = useCallback((activity: any) => {
    const activityKey = `${activity.type}_${activity.id}`
    const analysis = analysisResults[activityKey]
    
    if (!analysis) return null

    // Extraer puntos clave del análisis dinámico
    let summaryPoints = []
    
    // Si hay secciones dinámicas, extraer los puntos principales
    if (analysis.sections && analysis.sections.length > 0) {
      analysis.sections.forEach((section: any) => {
        // Extraer puntos según el formato de cada sección
        if (section.format === 'numbered-list' || section.format === 'bullet-list') {
          // Si es una lista, tomar los primeros elementos
          if (Array.isArray(section.content)) {
            summaryPoints.push(...section.content.slice(0, 3).map((item: string) => item))
          }
        } else if (section.format === 'text' && section.content) {
          // Si es texto, extraer la primera oración o párrafo
          const firstParagraph = section.content.split('\n')[0]
          if (firstParagraph && firstParagraph.length > 20) {
            summaryPoints.push(firstParagraph)
          }
        } else if (section.format === 'metrics' && Array.isArray(section.content)) {
          // Si son métricas, crear un resumen de las más importantes
          const keyMetrics = section.content.slice(0, 2).map((metric: any) => 
            `${metric.label}: ${metric.value}${metric.unit || ''}`
          )
          if (keyMetrics.length > 0) {
            summaryPoints.push(`Métricas clave: ${keyMetrics.join(', ')}`)
          }
        }
      })
    }
    
    // Si no hay puntos de las secciones, intentar con el formato anterior
    if (summaryPoints.length === 0 && analysis.fullAnalysis) {
      const sections = analysis.fullAnalysis.split(/(?=^##\s)/gm)
        .map((section: string) => section.trim())
        .filter((section: string) => section.length > 50)
      
      sections.forEach((section: string) => {
        const lines = section.split('\n').filter((line: string) => line.trim().length > 0)
        if (lines.length > 1) {
          const content = lines.slice(1, 3).join(' ')
          if (content.length > 20) {
            summaryPoints.push(content)
          }
        }
      })
    }
    
    // Fallback al summary si no hay puntos extraidos
    if (summaryPoints.length === 0 && analysis.summary) {
      summaryPoints = [analysis.summary]
    }

    return {
      summaryPoints: summaryPoints.slice(0, 5), // Máximo 5 puntos
      hasAnalysis: true
    }
  }, [analysisResults])

  // Función auxiliar para crear resúmenes coherentes para cards
  const createCardSummary = (text: string, maxWords: number = 150) => {
    if (!text) return ''
    
    const words = text.split(' ')
    if (words.length <= maxWords) return text
    
    // Cortar por palabras completas y buscar un punto de parada natural
    let summary = words.slice(0, maxWords).join(' ')
    
    // Intentar terminar en un punto natural (punto, coma, etc.)
    const lastChar = summary.slice(-1)
    if (!['.', ',', ';', ':', '!', '?'].includes(lastChar)) {
      summary += '...'
    }
    
    return summary
  }

  // Función para navegar a la vista de detalle
  const navigateToDetail = useCallback((activity: any) => {
    console.log('📦 NavigateToDetail llamado con activity:', activity)
//     console.log('🔍 Activity data:', {
//       id: activity?.id,
//       type: activity?.type,
//       name: activity?.name,
//       hasAllFields: !!(activity?.id && activity?.type && activity?.name)
//     })
    setDetailView({ isActive: true, activity })
  }, [])

  // Función para volver al dashboard general
  const navigateBackToDashboard = useCallback(() => {
    setDetailView(null)
  }, [])

  // Función para parsear el análisis en puntos individuales
  const parseAnalysisIntoPoints = useCallback((analysis: any) => {
    if (!analysis?.fullAnalysis) {
      console.log('⚠️ No se encontró fullAnalysis, intentando con summary')
      // Fallback: usar el summary como resumen ejecutivo si no hay fullAnalysis
      if (analysis?.summary) {
        return { points: [], summary: [analysis.summary] }
      }
      return { points: [], summary: [] }
    }

    const content = analysis.fullAnalysis
    const points = []
    let summaryPoints = []
    
    // Dividir por headers ## (secciones principales)
    const sections = content.split(/(?=^##\s)/gm)
      .map((section: string) => section.trim())
      .filter((section: string) => section.length > 20)

    if (sections.length > 1) {
      // Si hay secciones con headers, usar esas
      sections.forEach((section: string, index: number) => {
        // Extraer título y contenido
        const lines = section.split('\n')
        const headerLine = lines[0]
        const title = headerLine.replace(/^##\s*/, '').trim()
        const sectionContent = lines.slice(1).join('\n').trim()
        
        // Buscar si es el resumen ejecutivo (más flexible)
        if (title === 'RESUMEN_EJECUTIVO' || title.includes('RESUMEN') || title.includes('EJECUTIVO')) {
          // Extraer puntos del resumen
          summaryPoints = sectionContent
            .split('\n')
            .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•') || line.trim().startsWith('*'))
            .map(line => line.replace(/^[-•*]\s*/, '').trim())
            .filter(line => line.length > 10) // Filtrar líneas muy cortas
          
//           console.log('📋 Resumen ejecutivo encontrado:', summaryPoints)
        } else if (title && sectionContent && sectionContent.length > 50) {
          // Solo incluir secciones con contenido sustancial (más de 50 caracteres)
          points.push({
            id: `section-${index}`,
            title: title,
            content: sectionContent,
            type: detectContentType(sectionContent)
          })
//           console.log(`📋 Sección incluida: "${title}" (${sectionContent.length} caracteres)`)
        } else {
          console.log(`⚠️ Sección excluida: "${title}" - contenido insuficiente (${sectionContent?.length || 0} caracteres)`)
        }
      })
    } else {
      // Si no hay headers claros, intentar dividir por párrafos significativos
      const paragraphs = content.split(/\n\n+/)
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 50)
      
      paragraphs.forEach((paragraph: string, index: number) => {
        points.push({
          id: `point-${index}`,
          title: generateDefaultTitle(paragraph, index),
          content: paragraph,
          type: detectContentType(paragraph)
        })
      })
    }

    // Guardar el resumen en el análisis para uso posterior
    if (analysis && summaryPoints.length > 0) {
      analysis.executiveSummary = summaryPoints
    }

    return { points, summary: summaryPoints }
  }, [])

  // Función para generar títulos por defecto cuando no hay headers
  const generateDefaultTitle = (content: string, index: number) => {
    const type = detectContentType(content)
    switch (type) {
      case 'table':
        return 'Panorama General'
      case 'numbered-list':
        return 'Aspectos Clave Identificados'
      case 'bullet-list':
        return 'Puntos Destacados'
      case 'quote':
        return 'Observaciones'
      default:
        return 'Análisis Detallado'
    }
  }

  // Función auxiliar para detectar el tipo de contenido
  const detectContentType = (content: string) => {
    if (content.includes('|') && content.includes('---')) return 'table'
    if (content.match(/^\d+\./m)) return 'numbered-list'
    if (content.match(/^[-*+]\s/m)) return 'bullet-list'
    if (content.includes('```')) return 'code'
    if (content.startsWith('>')) return 'quote'
    return 'text'
  }

  // Prevent SSR/hydration issues - useEffect must be after all other hooks
  useEffect(() => {
    setMounted(true)
  }, [])

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />
      case 'disconnected':
        return <FontAwesomeIcon icon={faExclamationTriangle} className="text-yellow-500" />
      case 'failed':
      case 'error':
        return <FontAwesomeIcon icon={faTimesCircle} className="text-red-500" />
      default:
        return <FontAwesomeIcon icon={faSpinner} className="text-gray-500 animate-spin" />
    }
  }

  const getStatusMessage = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Conectado a Moodle con autenticación de sesión'
      case 'disconnected':
        return 'Desconectado de Moodle'
      case 'failed':
        return 'Error de conexión con Moodle'
      case 'error':
        return error || 'Error desconocido'
      default:
        return 'Conectando...'
    }
  }

  // Don't render anything until the component is mounted on client-side to prevent hydration errors
  if (!mounted) {
    return (
      <div className="max-w-[1132px] mx-auto px-4 sm:px-6 lg:px-3">
        <div className="flex items-center justify-center py-16">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4 w-64"></div>
            <div className="h-4 bg-gray-200 rounded mb-8 w-96"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Mostrar vista de detalle si está activa
  if (detailView?.isActive && detailView.activity) {
    const activityKey = `${detailView.activity.type}_${detailView.activity.id}`
    const analysis = analysisResults[activityKey]

    return (
      <div className="max-w-[1132px] mx-auto mb-4 px-4 sm:px-6 lg:px-3">
        {/* Header de seguimiento */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Reporte de {detailView.activity.name}
            </h1>
            
            {/* Chip con fecha y hora de análisis */}
            {analysis && (
              <div className="flex items-center space-x-2 bg-primary-light text-primary-darker px-4 py-2 rounded-full text-sm font-medium">
                <span>📅</span>
                <span>Fecha de corte del análisis: {new Date(analysis.generatedAt).toLocaleDateString('es-ES', { 
                  day: 'numeric', 
                  month: 'short',
                  year: 'numeric'
                })} - {new Date(analysis.generatedAt).toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}</span>
              </div>
            )}
          </div>
          
          <button 
            onClick={navigateBackToDashboard}
            className="flex items-center space-x-2 text-primary-darker hover:text-primary transition-colors mb-6"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="text-sm" />
            <span>Volver</span>
          </button>
        </section>

        {/* Mostrar componentes visuales dinámicos */}
        {analysis ? (
          <div className="space-y-6">
            {/* Secciones dinámicas (nuevo formato) */}
            {analysis.sections && analysis.sections.length > 0 ? (
              <div className="space-y-6">
                {(() => {
                  const sortedSections = analysis.sections.sort((a: any, b: any) => (a.priority || 999) - (b.priority || 999));
                  const elements: React.ReactNode[] = [];
                  let i = 0;
                  
                  while (i < sortedSections.length) {
                    const currentSection = sortedSections[i];
                    
                    // Si es formato 'cards', ocupar ancho completo
                    if (currentSection.format === 'cards') {
                      elements.push(
                        <DynamicSectionRenderer
                          key={currentSection.id || `section-${i}`}
                          section={currentSection}
                          className=""
                        />
                      );
                      i++;
                    } else {
                      // Verificar si hay otro elemento para hacer par
                      const nextSection = sortedSections[i + 1];
                      
                      if (nextSection && nextSection.format !== 'cards') {
                        // Crear fila con dos elementos
                        elements.push(
                          <div key={`row-${i}`} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <DynamicSectionRenderer
                              section={currentSection}
                              className=""
                            />
                            <DynamicSectionRenderer
                              section={nextSection}
                              className=""
                            />
                          </div>
                        );
                        i += 2;
                      } else {
                        // Elemento solo, ancho completo
                        elements.push(
                          <DynamicSectionRenderer
                            key={currentSection.id || `section-${i}`}
                            section={currentSection}
                            className=""
                          />
                        );
                        i++;
                      }
                    }
                  }
                  
                  return elements;
                })()}
              </div>
            ) : (
              // Formato anterior para compatibilidad
              <div className="space-y-6">
                {/* Tabla de métricas si existe */}
                {analysis.metricsTable && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Panorama General</h3>
                    <ContentParser content={analysis.metricsTable} />
                  </div>
                )}

                {/* Insights estructurados si existen */}
                {analysis.structuredInsights && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {analysis.structuredInsights.numbered && analysis.structuredInsights.numbered.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Insights Clave</h3>
                        <AnalysisList
                          items={analysis.structuredInsights.numbered}
                          numbered={true}
                        />
                      </div>
                    )}
                    
                    {analysis.structuredInsights.bullets && analysis.structuredInsights.bullets.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Observaciones</h3>
                        <AnalysisList
                          items={analysis.structuredInsights.bullets}
                          numbered={false}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Análisis completo como fallback */}
                {analysis.fullAnalysis && !analysis.metricsTable && !analysis.structuredInsights && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Análisis Detallado</h3>
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {analysis.fullAnalysis}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Puntos parseados del análisis anterior (solo si no hay sections) */}
            {(() => {
              const { points: analysisPoints } = parseAnalysisIntoPoints(analysis)
              if (analysisPoints.length > 0 && !analysis.sections && !analysis.metricsTable && !analysis.structuredInsights) {
                return (
                  <div className={`grid gap-6 ${analysisPoints.length === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
                    {analysisPoints.map((point, index) => {
                const getPointIcon = (type: string) => {
                  switch (type) {
                    case 'table': return '📊'
                    case 'numbered-list': return '📝'
                    case 'bullet-list': return '📋'
                    case 'code': return '💻'
                    case 'quote': return '💭'
                    default: return '📄'
                  }
                }

                const getPointTypeLabel = (type: string) => {
                  switch (type) {
                    case 'table': return 'Datos'
                    case 'numbered-list': return 'Pasos'
                    case 'bullet-list': return 'Puntos'
                    case 'code': return 'Código'
                    case 'quote': return 'Cita'
                    default: return 'Insight'
                  }
                }

                return (
                  <div key={point.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
                    {/* Header del point */}
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-semibold text-gray-900 font-inter">
                        {point.title}
                      </h3>
                      <span className="bg-blue-50 border border-blue-300 text-blue-700 px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 font-inter">
                        <span className="text-sm">{getPointIcon(point.type)}</span>
                        <span>{getPointTypeLabel(point.type)}</span>
                      </span>
                    </div>
                    
                    {/* Contenido del point con diseño adaptado */}
                    <div className="mb-4">
                      {point.type === 'table' ? (
                        // Diseño especial para tablas como en el ejemplo
                        <div className="space-y-3">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              table: ({children}) => <table className="w-full">{children}</table>,
                              thead: ({children}) => <thead>{children}</thead>,
                              tbody: ({children}) => <tbody>{children}</tbody>,
                              tr: ({children, ...props}) => {
                                const isHeader = props.isheader || (props as any).isheader;
                                return isHeader ? 
                                  <tr className="bg-primary text-white">{children}</tr> :
                                  <tr className="border-b border-gray-200">{children}</tr>
                              },
                              th: ({children}) => (
                                <th className="bg-primary text-white px-4 py-3 text-left font-semibold text-sm">
                                  {children}
                                </th>
                              ),
                              td: ({children}) => (
                                <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200 last:border-r-0">
                                  {children}
                                </td>
                              ),
                              p: ({children}) => <>{children}</>,
                              h1: () => null,
                              h2: () => null,
                              h3: () => null,
                            }}
                          >
                            {point.content}
                          </ReactMarkdown>
                        </div>
                      ) : point.type === 'numbered-list' || point.type === 'bullet-list' ? (
                        // Diseño especial para listas numeradas como en el ejemplo
                        <div className="space-y-3">
                          {(() => {
                            // Extraer elementos de lista del contenido con manejo mejorado
                            let listItems = []
                            
                            // Primero intentar split por líneas que empiecen con números o bullets
                            const potentialItems = point.content
                              .split(/\n(?=\d+\.\s+|[-*+]\s+)/)
                              .filter(item => item.trim().length > 0)
                            
                            if (potentialItems.length > 1) {
                              // Hay elementos de lista identificados
                              listItems = potentialItems.map(item => 
                                item.replace(/^\d+\.\s+|^[-*+]\s+/, '').trim()
                              ).filter(item => item.length > 0)
                            } else {
                              // Fallback: dividir por párrafos si no hay formato de lista
                              listItems = point.content
                                .split(/\n\n+/)
                                .map(item => item.trim())
                                .filter(item => item.length > 20) // Solo párrafos substanciales
                            }

                            // Si no hay elementos, mostrar el contenido completo como un solo punto
                            if (listItems.length === 0) {
                              listItems = [point.content.trim()]
                            }

                            return listItems.map((item, index) => (
                              <div key={index} className="flex gap-3">
                                <div className="flex-shrink-0 w-8 h-8 bg-primary-light text-primary-darker rounded-lg flex items-center justify-center font-semibold text-sm">
                                  {index + 1}
                                </div>
                                <div className="flex-1 text-sm text-gray-700 leading-relaxed pt-1">
                                  <ReactMarkdown 
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                      p: ({children}) => <>{children}</>,
                                      strong: ({children}) => <strong className="font-semibold text-gray-900">{children}</strong>,
                                      em: ({children}) => <em className="italic text-gray-600">{children}</em>,
                                    }}
                                  >
                                    {item.trim()}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            ))
                          })()}
                        </div>
                      ) : (
                        // Diseño estándar para otros tipos de contenido
                        <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-strong:text-gray-900 prose-em:text-gray-700">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: () => null, // Ocultar headers ya que están en el título
                              h2: () => null,
                              h3: () => null,
                              ul: ({children}) => <ul className="list-disc list-inside space-y-2 ml-2 text-gray-700">{children}</ul>,
                              ol: ({children}) => <ol className="list-decimal list-inside space-y-2 ml-2 text-gray-700">{children}</ol>,
                              blockquote: ({children}) => <blockquote className="border-l-4 border-primary-light pl-4 italic text-gray-600 my-3 bg-gray-50 py-2">{children}</blockquote>,
                              code: ({children}) => <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">{children}</code>,
                              pre: ({children}) => <pre className="bg-gray-100 p-4 rounded overflow-x-auto text-sm">{children}</pre>,
                              p: ({children}) => <p className="text-gray-700 mb-3 text-sm leading-relaxed">{children}</p>,
                              strong: ({children}) => <strong className="font-semibold text-gray-900">{children}</strong>,
                              em: ({children}) => <em className="italic text-gray-600">{children}</em>
                            }}
                          >
                            {point.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                    )
                  })}
                </div>
              )
            }
            return null
          })()}
          </div>
        ) : (
          <section className="mb-8">
            <div className="text-center py-12">
              <FontAwesomeIcon icon={faBrain} size="3x" className="text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Análisis no disponible
              </h3>
              <p className="text-gray-600 mb-4">
                Esta actividad aún no ha sido analizada
              </p>
              <button
                onClick={() => {
                  console.log('🔘 Botón Generar análisis presionado')
//                   console.log('🔍 detailView.activity:', detailView.activity)
                  if (detailView.activity) {
                    analyzeActivity(detailView.activity)
                  } else {
                    console.error('❌ detailView.activity es null o undefined')
                    alert('Error: No se encontró la información de la actividad')
                  }
                }}
                disabled={analyzingActivity === `${detailView.activity?.type}_${detailView.activity?.id}`}
                className={`px-6 py-2 rounded-lg transition-colors ${
                  analyzingActivity === `${detailView.activity?.type}_${detailView.activity?.id}` 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-primary hover:bg-primary-dark text-white'
                }`}
              >
                {analyzingActivity === `${detailView.activity?.type}_${detailView.activity?.id}` ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                    Analizando...
                  </>
                ) : (
                  'Generar análisis'
                )}
              </button>
            </div>
          </section>
        )}
      </div>
    )
  }

  // Vista principal del dashboard
  return (
    <div className="max-w-[1132px] mx-auto px-4 sm:px-6 lg:px-3">
      {/* Saludo */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-900">
            ¡Hola, {user.firstName}!
          </h1>

          <a
              href="https://forms.gle/xHNHcHHP6p8QDKzP7"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white shadow-sm transition-colors"
          >
            ¿No encuentras tu curso?
          </a>
        </div>
        
        <p className="text-gray-600 mb-2">
        En este dashboard encontrará un resumen de los hallazgos que su <strong>Asistente Docente</strong> ha identificado sobre la participación en foros y la entrega de tareas, junto con recomendaciones para fortalecer su acompañamiento académico        </p>
        
        {/* Indicador de caché sutil debajo del texto principal */}
        {selectedCourse && (() => {
          const cached = courseDataCache[selectedCourse]
          if (cached) {
            const now = Date.now()
            const timeSinceLastUpdate = now - cached.lastFetched
            const timeUntilUpdate = CACHE_DURATION - timeSinceLastUpdate
            const minutesUntilUpdate = Math.max(0, Math.ceil(timeUntilUpdate / (60 * 1000)))
            
            return (
              <div className="flex items-center gap-2 mb-4">
                
                <button
                  onClick={() => forceRefreshCurrentCourse()}
                  className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                  disabled={isAnalyzingBatch || isLoadingCourse}
                >
                  
                </button>
              </div>
            )
          }
          return <div className="mb-4"></div>
        })()}
        
        {/* Estado de conexión */}
        

        {/* Información del usuario */}
        {/* <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-blue-900 mb-2">
            🤖 Sistema de Autenticación Híbrida Activado
          </h3>
          <div className="text-sm text-blue-700 space-y-1">
            <p><strong>Matrícula:</strong> {user.matricula}</p>
            <p><strong>Estrategia:</strong> Token administrativo para lectura, token específico solo cuando sea necesario</p>
            <p><strong>Estado:</strong> {connectionStatus === 'connected' ? 'Funcionando automáticamente' : 'Verificando configuración...'}</p>
          </div>
        </div> */}
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Selector de curso */}
      {courses.length > 0 && (
        <>
          {/* Sección de análisis */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  Actividades analizadas
                </h2>
                {/* Indicador de caché */}
                {selectedCourse && courseDataCache[selectedCourse] && !isLoadingCourse && (
                  <div className="flex items-center gap-2">
                    {(() => {
                      const cached = courseDataCache[selectedCourse]
                      const now = Date.now()
                      const timeSinceLastUpdate = now - cached.lastFetched
                      const timeUntilUpdate = CACHE_DURATION - timeSinceLastUpdate
                      const minutesUntilUpdate = Math.max(0, Math.ceil(timeUntilUpdate / (60 * 1000)))
                      
                      return null
                    })()}
                  </div>
                )}
                
                {/* Queue status indicator removed - now using direct analysis with progress tracking */}
              </div>
              
              {/* Selector de curso simplificado */}
              <SimpleCourseSelector
                courses={courses}
                selectedCourseId={selectedCourse}
                onSelectionChange={handleCourseChange}
              />
            </div>

            {/* Mostrar contenido basado en si hay curso seleccionado */}
            {!selectedCourse ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="mb-6">
                    <svg className="w-20 h-20 text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <p className="text-xl font-medium text-gray-700 mb-2">
                    No hay curso seleccionado
                  </p>
                  <p className="text-gray-600 mb-6 max-w-md">
                    Selecciona un curso del menú superior
                  </p>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Los análisis se generan automáticamente al seleccionar un curso</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Contenido cuando hay curso seleccionado */}

                {/* Loader para cuando está cargando */}
                {isLoadingCourse ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="text-center">
                  <FontAwesomeIcon 
                    icon={loadingPhase === 'loading' ? faSpinner : faBrain} 
                    size="3x" 
                    className={`${loadingPhase === 'loading' ? 'text-blue-600 animate-spin' : 'text-primary animate-pulse'} mb-4`} 
                  />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {loadingPhase === 'loading' 
                      ? 'Cargando información...' 
                      : 'Analizando actividades...'}
                  </h3>
                  <p className="text-gray-600">
                    {loadingPhase === 'loading' 
                      ? 'Obteniendo actividades del curso seleccionado' 
                      : `Generando insights inteligentes con IA ${batchProgress.total > 0 ? `(${batchProgress.current}/${batchProgress.total})` : ''}`}
                  </p>
                  {/* Barra de progreso para análisis batch */}
                  {loadingPhase === 'analyzing' && batchProgress.total > 0 && (
                    <div className="mt-4 w-full max-w-md">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out" 
                          style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-gray-500 mt-2 text-center">
                        {batchProgress.current} de {batchProgress.total} actividades analizadas
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Cards de actividades abiertas - Acumulativas */}
                {openActivities.length > 0 ? (
                  <div className="mb-8">
                    <div className={`grid gap-6 ${getVisibleActivities.length === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-2'} auto-rows-fr`}>
                  {getVisibleActivities.map((activity, index) => {
                    const getActivityIcon = (type: string) => {
                      switch (type) {
                        case 'forum': return '💬'
                        case 'assign': return '📝'
                        case 'quiz': return '📊'
                        case 'feedback': return '📋'
                        case 'choice': return '🗳️'
                        case 'survey': return '📋'
                        case 'lesson': return '📖'
                        default: return '🎯'
                      }
                    }

                    const getActivityType = (type: string) => {
                      switch (type) {
                        case 'forum': return 'Foro'
                        case 'assign': return 'Tarea'
                        case 'quiz': return 'Cuestionario'
                        case 'feedback': return 'Encuesta'
                        case 'choice': return 'Elección'
                        case 'survey': return 'Encuesta'
                        case 'lesson': return 'Lección'
                        default: return 'Actividad'
                      }
                    }

                    const getStatusColor = (status: string) => {
                      switch (status) {
                        case 'open': return 'border-green-500 text-green-700'
                        case 'overdue': return 'border-orange-500 text-orange-700'
                        case 'not_started': return 'border-blue-500 text-blue-700'
                        case 'closed': return 'border-red-500 text-red-700'
                        default: return 'border-gray-500 text-gray-700'
                      }
                    }

                    const getStatusText = (status: string) => {
                      switch (status) {
                        case 'open': return 'Disponible'
                        case 'overdue': return 'Vencida'
                        case 'not_started': return 'Próximamente'
                        case 'closed': return 'Cerrada'
                        default: return 'Desconocido'
                      }
                    }

                    return (
                      <div key={activity.id} className="bg-white border border-gray-300 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                        {/* Header - siempre en la parte superior */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-2">
                            
                            <h3 className="text-lg font-semibold text-primary-darker font-inter">
                              {activity.name}
                            </h3>
                          </div>
                          <span className={`bg-white border px-3 py-1 rounded-[100px] text-sm font-semibold flex items-center space-x-1 font-inter ${getStatusColor(activity.status)}`}>
                          <span className="text-md">{getActivityIcon(activity.type)}</span><span>{getActivityType(activity.type)}</span>
                          </span>
                        </div>
                        
                        {/* Contenido con flex-grow para ocupar el espacio disponible */}
                        <div className="flex-grow flex flex-col">
                          {/* Análisis inteligente, loader o indicador sin análisis */}
                          {(() => {
                            const activityKey = `${activity.type}_${activity.id}`
                            const isAnalyzing = analyzingActivity === activityKey
                            const analysisExtract = getAnalysisExtract(activity)
                            
                            if (isAnalyzing || (isAnalyzingBatch && !analysisResults[activityKey])) {
                              // Mostrar loader durante análisis
                              return (
                                <div className="flex-grow flex items-center justify-center">
                                  <div className="bg-blue-50 rounded-lg p-6 border border-blue-200 w-full">
                                    <div className="text-center">
                                      <FontAwesomeIcon icon={faSpinner} size="2x" className="text-blue-600 mb-3 animate-spin" />
                                      <p className="text-sm font-medium text-blue-900">
                                        Generando análisis inteligente...
                                      </p>
                                      <p className="text-xs text-blue-700 mt-1">
                                        Procesando información de la actividad
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )
                            }
                            
                            if (analysisExtract && analysisExtract.summaryPoints) {
                              // TEMPORALMENTE VACÍO - Sin contenido de análisis
                              return null
                            } else {
                              // Solo mostrar indicador de análisis pendiente
                              return (
                                <div className="flex-grow flex items-center justify-center">
                                  <div className="text-center text-gray-400">
                                    <FontAwesomeIcon icon={faBrain} size="2x" className="mb-3" />
                                    <p className="text-sm">
                                      Actividad sin analizar
                                    </p>
                                  </div>
                                </div>
                              )
                            }
                          })()}
                        </div>
                        
                        {/* Footer con botones de acción - siempre en la parte inferior */}
                        <div className="flex justify-between items-center mt-6">
                          {/* Botones de la izquierda */}
                          <div className="flex items-center space-x-1">
                            {/* Botón de análisis forzado */}
                            <button
                              onClick={() => analyzeActivity(activity)}
                              disabled={analyzingActivity === `${activity.type}_${activity.id}`}
                              className={`px-3 py-2 rounded-lg text-sm font-medium font-inter transition-all flex items-center space-x-2 ${
                                analyzingActivity === `${activity.type}_${activity.id}`
                                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  : ' text-icon-dark'
                              }`}
                              title="Actualizar"
                            >
                              {analyzingActivity === `${activity.type}_${activity.id}` ? (
                                <>
                                  <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                                  <span>Analizando...</span>
                                </>
                              ) : (
                                <>
                                  <FontAwesomeIcon icon={faRefresh} />
                                  <span></span>
                                </>
                              )}
                            </button>
                            
                            {/* Botón de ir a Moodle */}
                            {activity.url && (
                              <a
                                href={activity.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 rounded-lg text-sm font-medium font-inter transition-all flex items-center space-x-2  text-icon-dark "
                                title="Ir al aula"
                              >
                                <FontAwesomeIcon icon={faExternalLinkAlt}  />
                                <span></span>
                              </a>
                            )}
                          </div>
                          
                          {/* Ver más con el mismo estilo que Actualizar - Ocultar durante análisis */}
                          {(() => {
                            const activityKey = `${activity.type}_${activity.id}`
                            const isAnalyzing = analyzingActivity === activityKey
                            
                            return !isAnalyzing && !(isAnalyzingBatch && !analysisResults[activityKey]) && (
                              <button 
                                onClick={() => {
                                  // Navegar a la vista de detalle
                                  navigateToDetail(activity)
                                }}
                                title="Ver más"
                                className="px-3 py-2 rounded-lg text-sm font-medium font-inter transition-all flex items-center space-x-2 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:shadow-[0_4px_10px_0_rgba(0,0,0,0.20)] shadow-[0_2px_6px_0_rgba(0,0,0,0.10)]"
                              >
                                <span>Ver más</span>
                                <FontAwesomeIcon icon={faChevronDown} className="rotate-[-90deg]" />
                              </button>
                            )
                          })()}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                      <FontAwesomeIcon icon={faMagicWandSparkles} size="3x" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No hay actividades disponibles
                    </h3>
                    <p className="text-gray-600">
                      Este curso no tiene actividades abiertas en este momento
                    </p>
                  </div>
                )}
              </>
            )}
              </>
            )}
          </section>
        </>
      )}

      {/* Información sobre el sistema híbrido */}
      {/* <section className="bg-gray-50 rounded-lg p-6 mt-8">
        <h3 className="font-semibold text-gray-900 mb-3">
          🔒 Sistema de Autenticación Híbrida
        </h3>
        <div className="text-sm text-gray-700 space-y-2">
          <div className="flex items-start space-x-2">
            <span className="text-green-600">✓</span>
            <span>Operaciones de lectura usan token administrativo global</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-green-600">✓</span>
            <span>Operaciones específicas usan token del profesor automáticamente</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-green-600">✓</span>
            <span>Sin configuración manual requerida</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-green-600">✓</span>
            <span>Fallback automático entre tipos de token</span>
          </div>
        </div>
      </section> */}

      {/* Modal de Análisis */}
      <AnalysisModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setSelectedAnalysis(null)
          setSelectedActivityName('')
          setSelectedActivityType('')
        }}
        analysis={selectedAnalysis}
        activityName={selectedActivityName}
        activityType={selectedActivityType}
      />
    </div>
  )
}
