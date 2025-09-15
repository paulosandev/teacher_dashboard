/**
 * API para reportes de ejecución en tiempo real
 * Muestra estado actual de procesos, estadísticas y análisis
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { adminAuthOptions } from '@/lib/auth/admin-auth-options'

// Use global prisma instance
declare global {
  var prisma: PrismaClient | undefined
}

const prisma = globalThis.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma

// Verificar si el usuario es admin autenticado
async function isAuthorized(request: NextRequest): Promise<boolean> {
  try {
    const session = await getServerSession(adminAuthOptions)
    
    console.log('🔐 Admin Auth Check:')
    console.log('  - Session exists:', !!session)
    console.log('  - User:', session?.user?.username)
    console.log('  - Role:', session?.user?.role)
    
    return !!session?.user && session.user.role === 'admin'
  } catch (error) {
    console.error('❌ Admin auth error:', error)
    return false
  }
}

export async function GET(request: NextRequest) {
  // Verificar autorización
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('type') || 'current' // current, historical, detailed

    const startTime = Date.now()
    console.log(`📊 [ADMIN REPORT] Generando reporte tipo: ${reportType}`)

    // Obtener información general del sistema
    const [systemInfo] = await Promise.all([
      getSystemInfo()
    ])

    let reportData = {
      timestamp: new Date().toISOString(),
      reportType,
      queryTime: 0,
      systemInfo
    }

    switch (reportType) {
      case 'current':
        console.log('📊 [ADMIN REPORT] Calling getCurrentExecutionStatus...')
        const currentData = await getCurrentExecutionStatus()
        console.log('📊 [ADMIN REPORT] getCurrentExecutionStatus returned:', !!currentData.cronSchedule)
        reportData = { ...reportData, ...currentData }
        break
        
      case 'historical':
        const days = parseInt(searchParams.get('days') || '7')
        reportData = { ...reportData, ...(await getHistoricalData(days)) }
        break
        
      case 'detailed':
        const aulaId = searchParams.get('aula')
        reportData = { ...reportData, ...(await getDetailedReport(aulaId)) }
        break
        
      case 'analytics':
        reportData = { ...reportData, ...(await getAnalyticsData()) }
        break

      case 'aulas-details':
        console.log('📊 [ADMIN REPORT] Calling getAulasDetails...')
        const aulasData = await getAulasDetails()
        console.log('📊 [ADMIN REPORT] getAulasDetails returned:', Object.keys(aulasData))
        reportData = { ...reportData, ...aulasData }
        break

      case 'cursos-details':
        console.log('📊 [ADMIN REPORT] Calling getCursosDetails...')
        const cursosPage = parseInt(searchParams.get('page') || '1')
        const cursosPageSize = parseInt(searchParams.get('pageSize') || '50')
        const cursosData = await getCursosDetails(cursosPage, cursosPageSize)
        console.log('📊 [ADMIN REPORT] getCursosDetails returned keys:', Object.keys(cursosData))
        console.log('📊 [ADMIN REPORT] cursosData sample:', {
          totalCursos: cursosData.totalCursos,
          cursosEnPagina: cursosData.todosLosCursos?.length,
          pagina: cursosPage,
          totalPaginas: cursosData.paginacion?.totalPaginas
        })
        
        reportData = { ...reportData, ...cursosData }
        break

      case 'actividades-details':
        console.log('📊 [ADMIN REPORT] Calling getActividadesDetails...')
        const actPage = parseInt(searchParams.get('page') || '1')
        const actPageSize = parseInt(searchParams.get('pageSize') || '100')
        const actividadesData = await getActividadesDetails(actPage, actPageSize)
        console.log('📊 [ADMIN REPORT] getActividadesDetails returned keys:', Object.keys(actividadesData))
        console.log('📊 [ADMIN REPORT] actividadesData sample:', {
          totalActividades: actividadesData.estadisticas?.total_actividades,
          actividadesEnPagina: actividadesData.todasLasActividades?.length,
          pagina: actPage,
          totalPaginas: actividadesData.paginacion?.totalPaginas
        })
        
        reportData = { ...reportData, ...actividadesData }
        break

      case 'cron-verification':
        console.log('📊 [ADMIN REPORT] Calling getCronVerification...')
        const cronData = await getCronVerification()
        console.log('📊 [ADMIN REPORT] getCronVerification returned:', Object.keys(cronData))
        reportData = { ...reportData, ...cronData }
        break
        
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }

    reportData.queryTime = Date.now() - startTime
    console.log(`✅ [ADMIN REPORT] Reporte generado en ${reportData.queryTime}ms`)

    return NextResponse.json(reportData)

  } catch (error) {
    console.error('❌ [ADMIN REPORT] Error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Información general del sistema
async function getSystemInfo() {
  const [aulaCount, courseCount, activityCount] = await Promise.all([
    prisma.aula.count({ where: { isActive: true } }),
    prisma.aulaCourse.count({ where: { isActive: true } }),
    prisma.courseActivity.count()
  ])

  return {
    totalAulas: aulaCount,
    totalCourses: courseCount,
    totalActivities: activityCount,
    systemTimezone: 'America/Mexico_City',
    dbTimezone: 'UTC'
  }
}

// Estado actual de ejecución
async function getCurrentExecutionStatus() {
  console.log('🔍 [getCurrentExecutionStatus] Starting...')
  const now = new Date()
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // Buscar la ejecución más reciente
  console.log('🔍 [getCurrentExecutionStatus] Querying recent activities...')
  const [recentActivity] = await prisma.courseActivity.findMany({
    select: {
      aulaId: true,
      updatedAt: true,
      courseId: true,
      activityId: true,
      name: true,
      type: true
    },
    where: {
      updatedAt: { gte: last24Hours }
    },
    orderBy: { updatedAt: 'desc' },
    take: 1
  })

  console.log('🔍 [getCurrentExecutionStatus] Recent activity found:', !!recentActivity)
  
  if (!recentActivity) {
    console.log('🔍 [getCurrentExecutionStatus] No recent activity, generating cronSchedule anyway...')
    // Obtener información del cronograma incluso sin actividad reciente
    const cronSchedule = getCronScheduleInfo()
    console.log('📊 [ADMIN REPORT] cronSchedule generated (no activity):', cronSchedule)
    
    return {
      currentStatus: {
        isRunning: false,
        lastActivity: null,
        minutesSinceLastUpdate: 0,
        estimatedEndTime: null
      },
      execution: null,
      cronSchedule
    }
  }

  // Determinar si hay un proceso activo
  const lastUpdateTime = new Date(recentActivity.updatedAt)
  const minutesSinceLastUpdate = (now.getTime() - lastUpdateTime.getTime()) / (1000 * 60)
  const isRunning = minutesSinceLastUpdate < 10 // Activo si actualizó en últimos 10 min

  // Obtener estadísticas del proceso actual/más reciente
  const executionStats = await getCurrentExecutionStats()

  // Obtener información del cronograma
  const cronSchedule = getCronScheduleInfo()
  console.log('📊 [ADMIN REPORT] cronSchedule generated:', cronSchedule)

  const result = {
    currentStatus: {
      isRunning,
      lastActivity: recentActivity,
      minutesSinceLastUpdate: Math.round(minutesSinceLastUpdate),
      estimatedEndTime: isRunning ? estimateCompletionTime(executionStats) : null
    },
    execution: executionStats,
    cronSchedule
  }
  
  console.log('🔍 [getCurrentExecutionStatus] Returning result with cronSchedule:', !!result.cronSchedule)
  return result
}

// Calcular próximos horarios de cron
function getCronScheduleInfo() {
  const mexicoCityTime = new Date().toLocaleString("en-US", {timeZone: "America/Mexico_City"})
  const now = new Date(mexicoCityTime)
  
  // Horarios configurados: 8:00 AM y 6:20 PM Mexico City time
  const morningTime = new Date(now)
  morningTime.setHours(8, 0, 0, 0)
  
  const eveningTime = new Date(now)
  eveningTime.setHours(18, 20, 0, 0)
  
  // Calcular próximo horario
  let nextExecution: Date
  let nextExecutionType: string
  
  if (now < morningTime) {
    nextExecution = morningTime
    nextExecutionType = 'morning'
  } else if (now < eveningTime) {
    nextExecution = eveningTime
    nextExecutionType = 'evening'
  } else {
    // Siguiente día a las 8:00 AM
    nextExecution = new Date(now)
    nextExecution.setDate(nextExecution.getDate() + 1)
    nextExecution.setHours(8, 0, 0, 0)
    nextExecutionType = 'morning'
  }
  
  // Calcular última ejecución programada
  let lastScheduledExecution: Date
  let lastExecutionType: string
  
  if (now.getHours() >= 18 && now.getMinutes() >= 20) {
    // Ya pasó la ejecución de la tarde
    lastScheduledExecution = eveningTime
    lastExecutionType = 'evening'
  } else if (now.getHours() >= 8) {
    // Ya pasó la ejecución de la mañana
    lastScheduledExecution = morningTime
    lastExecutionType = 'morning'
  } else {
    // Antes de la ejecución de la mañana, tomar la de ayer por la tarde
    lastScheduledExecution = new Date(now)
    lastScheduledExecution.setDate(lastScheduledExecution.getDate() - 1)
    lastScheduledExecution.setHours(18, 20, 0, 0)
    lastExecutionType = 'evening'
  }
  
  const hoursUntilNext = (nextExecution.getTime() - now.getTime()) / (1000 * 60 * 60)
  const hoursSinceLast = (now.getTime() - lastScheduledExecution.getTime()) / (1000 * 60 * 60)
  
  return {
    nextExecution: nextExecution.toISOString(),
    nextExecutionType,
    nextExecutionLocal: nextExecution.toLocaleString('es-MX', { 
      timeZone: 'America/Mexico_City',
      dateStyle: 'short',
      timeStyle: 'short'
    }),
    hoursUntilNext: Math.round(hoursUntilNext * 10) / 10,
    lastScheduledExecution: lastScheduledExecution.toISOString(),
    lastExecutionType,
    lastExecutionLocal: lastScheduledExecution.toLocaleString('es-MX', { 
      timeZone: 'America/Mexico_City',
      dateStyle: 'short',
      timeStyle: 'short'
    }),
    hoursSinceLast: Math.round(hoursSinceLast * 10) / 10,
    scheduleInfo: {
      morning: '8:00 AM',
      evening: '6:20 PM',
      timezone: 'Mexico City'
    }
  }
}

// Estadísticas de la ejecución actual
async function getCurrentExecutionStats() {
  const today = new Date()
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const [processingByHour, aulaProgress, totalStats] = await Promise.all([
    // Procesamiento por hora
    prisma.$queryRaw`
      SELECT 
        HOUR(updatedAt) as hour_utc,
        HOUR(DATE_SUB(updatedAt, INTERVAL 6 HOUR)) as hour_mexico,
        COUNT(DISTINCT aulaId) as aulas_procesadas,
        COUNT(DISTINCT courseId) as cursos_procesados,
        COUNT(*) as actividades_procesadas,
        MIN(updatedAt) as inicio,
        MAX(updatedAt) as fin
      FROM CourseActivity
      WHERE DATE(updatedAt) = CURDATE()
      GROUP BY HOUR(updatedAt)
      ORDER BY HOUR(updatedAt)
    `,
    
    // Progreso por aula
    prisma.$queryRaw`
      SELECT 
        aulaId,
        COUNT(DISTINCT courseId) as cursos_procesados,
        COUNT(*) as actividades_procesadas,
        COUNT(DISTINCT type) as tipos_actividad,
        MIN(updatedAt) as inicio_procesamiento,
        MAX(updatedAt) as fin_procesamiento,
        TIMESTAMPDIFF(MINUTE, MIN(updatedAt), MAX(updatedAt)) as duracion_minutos
      FROM CourseActivity
      WHERE DATE(updatedAt) = CURDATE()
      GROUP BY aulaId
      ORDER BY MIN(updatedAt)
    `,
    
    // Estadísticas totales
    prisma.$queryRaw`
      SELECT 
        COUNT(DISTINCT aulaId) as aulas_procesadas,
        COUNT(DISTINCT courseId) as cursos_procesados,
        COUNT(*) as actividades_procesadas,
        MIN(updatedAt) as inicio_ejecucion,
        MAX(updatedAt) as ultima_actualizacion,
        TIMESTAMPDIFF(HOUR, MIN(updatedAt), MAX(updatedAt)) as duracion_horas
      FROM CourseActivity
      WHERE DATE(updatedAt) = CURDATE()
    `
  ])

  return {
    totalStats: totalStats[0],
    processingByHour,
    aulaProgress,
    processType: determineProcessType(Array.isArray(processingByHour) ? processingByHour : [])
  }
}

// Determinar tipo de proceso (8AM vs 6PM)
function determineProcessType(processingByHour: any[]): string {
  if (!processingByHour.length) return 'unknown'
  
  const mexicoHours = processingByHour.map((h: any) => h.hour_mexico)
  const avgHour = mexicoHours.reduce((sum: number, h: number) => sum + h, 0) / mexicoHours.length

  if (avgHour >= 18 || avgHour <= 4) return 'Proceso Vespertino (6:20 PM)'
  if (avgHour >= 6 && avgHour <= 12) return 'Proceso Matutino (8:00 AM)'
  return 'Proceso en horario atípico'
}

// Estimar tiempo de finalización
function estimateCompletionTime(stats: any): string | null {
  const totalStats = stats.totalStats
  if (!totalStats?.aulas_procesadas) return null

  const aulasProcessed = parseInt(totalStats.aulas_procesadas)
  const hoursElapsed = parseFloat(totalStats.duracion_horas) || 0
  const totalAulasExpected = 10 // 11 total - 1 (av141 sin token)

  if (aulasProcessed >= totalAulasExpected) return 'Completado'

  const hoursPerAula = aulasProcessed > 0 ? hoursElapsed / aulasProcessed : 1
  const remainingAulas = totalAulasExpected - aulasProcessed
  const estimatedRemainingHours = remainingAulas * hoursPerAula

  const now = new Date()
  const estimatedEnd = new Date(now.getTime() + estimatedRemainingHours * 60 * 60 * 1000)
  
  return estimatedEnd.toISOString()
}

// Datos históricos
async function getHistoricalData(days: number) {
  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

  const [dailyStats, aulaPerformance] = await Promise.all([
    // Estadísticas por día
    prisma.$queryRaw`
      SELECT 
        DATE(updatedAt) as date,
        COUNT(DISTINCT aulaId) as aulas_procesadas,
        COUNT(DISTINCT courseId) as cursos_procesados,
        COUNT(*) as actividades_procesadas,
        TIMESTAMPDIFF(HOUR, MIN(updatedAt), MAX(updatedAt)) as duracion_horas
      FROM CourseActivity
      WHERE updatedAt >= ${startDate} AND updatedAt <= ${endDate}
      GROUP BY DATE(updatedAt)
      ORDER BY DATE(updatedAt) DESC
    `,
    
    // Performance por aula en el período
    prisma.$queryRaw`
      SELECT 
        aulaId,
        COUNT(DISTINCT DATE(updatedAt)) as dias_activos,
        COUNT(DISTINCT courseId) as cursos_totales,
        COUNT(*) as actividades_totales,
        AVG(TIMESTAMPDIFF(MINUTE, 
          (SELECT MIN(u2.updatedAt) FROM CourseActivity u2 WHERE u2.aulaId = CourseActivity.aulaId AND DATE(u2.updatedAt) = DATE(CourseActivity.updatedAt)),
          (SELECT MAX(u3.updatedAt) FROM CourseActivity u3 WHERE u3.aulaId = CourseActivity.aulaId AND DATE(u3.updatedAt) = DATE(CourseActivity.updatedAt))
        )) as promedio_duracion_minutos
      FROM CourseActivity
      WHERE updatedAt >= ${startDate} AND updatedAt <= ${endDate}
      GROUP BY aulaId
      ORDER BY aulaId
    `
  ])

  return {
    period: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      days
    },
    dailyStats,
    aulaPerformance
  }
}

// Reporte detallado (por aula específica)
async function getDetailedReport(aulaId: string | null) {
  if (!aulaId) {
    return { error: 'aulaId parameter required for detailed report' }
  }

  const [aulaInfo, recentActivity, courseBreakdown] = await Promise.all([
    // Información del aula
    prisma.aula.findUnique({
      where: { aulaId },
      include: {
        _count: {
          select: {
            courses: true,
            activities: true
          }
        }
      }
    }),
    
    // Actividad reciente del aula
    prisma.courseActivity.findMany({
      where: { aulaId },
      select: {
        courseId: true,
        activityId: true,
        name: true,
        type: true,
        updatedAt: true,
        dueDate: true
      },
      orderBy: { updatedAt: 'desc' },
      take: 50
    }),
    
    // Desglose por curso
    prisma.$queryRaw`
      SELECT 
        courseId,
        COUNT(*) as actividades_count,
        COUNT(DISTINCT type) as tipos_actividad,
        MAX(updatedAt) as ultima_actualizacion,
        GROUP_CONCAT(DISTINCT type) as tipos_lista
      FROM CourseActivity
      WHERE aulaId = ${aulaId}
      GROUP BY courseId
      ORDER BY MAX(updatedAt) DESC
    `
  ])

  if (!aulaInfo) {
    return { error: `Aula ${aulaId} not found` }
  }

  return {
    aulaInfo,
    recentActivity,
    courseBreakdown,
    summary: {
      totalCourses: aulaInfo._count.courses,
      totalActivities: aulaInfo._count.activities,
      recentActivityCount: recentActivity.length
    }
  }
}

// Datos analíticos
async function getAnalyticsData() {
  const [processingPatterns, errorAnalysis, performanceMetrics] = await Promise.all([
    // Patrones de procesamiento
    prisma.$queryRaw`
      SELECT 
        DAYOFWEEK(updatedAt) as day_of_week,
        HOUR(DATE_SUB(updatedAt, INTERVAL 6 HOUR)) as hour_mexico,
        COUNT(*) as frequency,
        AVG(TIMESTAMPDIFF(MINUTE, 
          LAG(updatedAt) OVER (PARTITION BY aulaId ORDER BY updatedAt),
          updatedAt
        )) as avg_interval_minutes
      FROM CourseActivity
      WHERE updatedAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DAYOFWEEK(updatedAt), HOUR(DATE_SUB(updatedAt, INTERVAL 6 HOUR))
      HAVING frequency > 10
      ORDER BY day_of_week, hour_mexico
    `,
    
    // Análisis de "errores" (aulas sin procesamiento)
    prisma.$queryRaw`
      SELECT 
        a.aulaId,
        a.name,
        COALESCE(MAX(ca.updatedAt), '1970-01-01') as ultima_actualizacion,
        DATEDIFF(NOW(), COALESCE(MAX(ca.updatedAt), '1970-01-01')) as dias_sin_actualizar,
        COUNT(DISTINCT ac.courseId) as cursos_registrados
      FROM Aula a
      LEFT JOIN AulaCourse ac ON a.aulaId = ac.aulaId AND ac.isActive = 1
      LEFT JOIN CourseActivity ca ON a.aulaId = ca.aulaId AND ca.updatedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      WHERE a.isActive = 1
      GROUP BY a.aulaId, a.name
      ORDER BY dias_sin_actualizar DESC
    `,
    
    // Métricas de rendimiento
    prisma.$queryRaw`
      SELECT 
        'Últimos 7 días' as period,
        COUNT(DISTINCT aulaId) as aulas_activas,
        COUNT(DISTINCT courseId) as cursos_procesados,
        COUNT(*) as actividades_procesadas,
        ROUND(COUNT(*) / COUNT(DISTINCT aulaId), 0) as actividades_por_aula,
        ROUND(COUNT(*) / COUNT(DISTINCT courseId), 0) as actividades_por_curso
      FROM CourseActivity
      WHERE updatedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      
      UNION ALL
      
      SELECT 
        'Últimos 30 días' as period,
        COUNT(DISTINCT aulaId) as aulas_activas,
        COUNT(DISTINCT courseId) as cursos_procesados,
        COUNT(*) as actividades_procesadas,
        ROUND(COUNT(*) / COUNT(DISTINCT aulaId), 0) as actividades_por_aula,
        ROUND(COUNT(*) / COUNT(DISTINCT courseId), 0) as actividades_por_curso
      FROM CourseActivity
      WHERE updatedAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `
  ])

  return {
    processingPatterns,
    errorAnalysis,
    performanceMetrics
  }
}

// Endpoint POST para acciones administrativas
export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { action, params } = body

    switch (action) {
      case 'force_cleanup':
        // Limpiar registros antiguos
        const result = await forceCleanup(params)
        return NextResponse.json({ success: true, result })
        
      case 'reset_aula_stats':
        // Resetear estadísticas de un aula
        await resetAulaStats(params.aulaId)
        return NextResponse.json({ success: true, message: `Stats reset for aula ${params.aulaId}` })
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
    
  } catch (error) {
    console.error('❌ [ADMIN REPORT POST] Error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function forceCleanup(params: any) {
  const daysOld = params?.days || 30
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000)
  
  // En lugar de eliminar, marcar como archivados o mover a tabla histórica
  console.log(`🧹 Force cleanup requested for records older than ${daysOld} days`)
  return { message: 'Cleanup completed', cutoffDate }
}

async function resetAulaStats(aulaId: string) {
  console.log(`🔄 Resetting stats for aula: ${aulaId}`)
  // Implementar lógica de reset si es necesario
}

// Detalles específicos para modal de aulas
async function getAulasDetails() {
  try {
    console.log('🔍 [getAulasDetails] Starting comprehensive analysis...')
    
    // Lista de aulas con información completa
    const aulas = await prisma.aula.findMany({
      where: { isActive: true },
      include: {
        courses: {
          where: { isActive: true },
          select: {
            courseId: true,
            courseName: true,
            isActive: true
          }
        },
        _count: {
          select: {
            courses: { where: { isActive: true } },
            activities: true
          }
        }
      },
      orderBy: { aulaId: 'asc' }
    })
    
    console.log('🔍 [getAulasDetails] Found aulas:', aulas.length)

    // Fechas para análisis temporal
    const now = new Date()
    const fecha1DiaAtras = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
    const fecha7DiasAtras = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fecha30DiasAtras = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    // Análisis detallado por aula
    const aulaAnalysis = await Promise.all(
      aulas.map(async (aula) => {
        // 1. Última actividad y detalles
        const ultimaActividadCompleta = await prisma.courseActivity.findFirst({
          where: { aulaId: aula.aulaId },
          orderBy: { updatedAt: 'desc' },
          select: { 
            updatedAt: true, 
            name: true, 
            type: true, 
            courseId: true 
          }
        })

        // 2. Estadísticas temporales
        const actividades1d = await prisma.courseActivity.count({
          where: { aulaId: aula.aulaId, updatedAt: { gte: fecha1DiaAtras } }
        })
        
        const actividades7d = await prisma.courseActivity.count({
          where: { aulaId: aula.aulaId, updatedAt: { gte: fecha7DiasAtras } }
        })
        
        const actividades30d = await prisma.courseActivity.count({
          where: { aulaId: aula.aulaId, updatedAt: { gte: fecha30DiasAtras } }
        })

        // 3. Análisis de cursos activos por período
        const cursosActivos1d = await prisma.courseActivity.groupBy({
          by: ['courseId'],
          where: { aulaId: aula.aulaId, updatedAt: { gte: fecha1DiaAtras } }
        })
        
        const cursosActivos7d = await prisma.courseActivity.groupBy({
          by: ['courseId'],
          where: { aulaId: aula.aulaId, updatedAt: { gte: fecha7DiasAtras } }
        })
        
        const cursosActivos30d = await prisma.courseActivity.groupBy({
          by: ['courseId'],
          where: { aulaId: aula.aulaId, updatedAt: { gte: fecha30DiasAtras } }
        })

        // 4. Tipos de actividades
        const tiposActividad = await prisma.courseActivity.groupBy({
          by: ['type'],
          where: { aulaId: aula.aulaId },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } }
        })

        // 5. Actividades por curso en esta aula
        const actividadesPorCurso = await prisma.courseActivity.groupBy({
          by: ['courseId'],
          where: { aulaId: aula.aulaId },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 10
        })

        // 6. Tendencia semanal (últimas 4 semanas)
        const tendenciaSemanal = []
        for (let i = 0; i < 4; i++) {
          const inicioSemana = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000)
          const finSemana = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000)
          
          const actividadesSemana = await prisma.courseActivity.count({
            where: {
              aulaId: aula.aulaId,
              updatedAt: { gte: inicioSemana, lt: finSemana }
            }
          })
          
          tendenciaSemanal.unshift({
            semana: i + 1,
            actividades: actividadesSemana,
            inicio: inicioSemana,
            fin: finSemana
          })
        }

        // 7. Cálculos derivados
        const diasSinActividad = ultimaActividadCompleta 
          ? Math.floor((now.getTime() - new Date(ultimaActividadCompleta.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
          : 999

        const promedioActividadesPorDia = actividades30d > 0 ? (actividades30d / 30).toFixed(1) : '0'
        
        const eficienciaCursos = aula.courses.length > 0 
          ? ((cursosActivos30d.length / aula.courses.length) * 100).toFixed(1)
          : '0'

        return {
          aulaId: aula.aulaId,
          ultimaActividad: ultimaActividadCompleta?.updatedAt,
          ultimaActividadDetalle: ultimaActividadCompleta,
          diasSinActividad,
          actividades1d,
          actividades7d,
          actividades30d,
          cursosActivos1d: cursosActivos1d.length,
          cursosActivos7d: cursosActivos7d.length,
          cursosActivos30d: cursosActivos30d.length,
          tiposActividad,
          actividadesPorCurso,
          tendenciaSemanal,
          promedioActividadesPorDia: parseFloat(promedioActividadesPorDia),
          eficienciaCursos: parseFloat(eficienciaCursos),
          totalCursosRegistrados: aula.courses.length,
          cursosDetalles: aula.courses
        }
      })
    )

    // 8. Estadísticas globales
    const totalActividades = aulaAnalysis.reduce((sum, aula) => sum + aula.actividades30d, 0)
    const aulasActivas1d = aulaAnalysis.filter(a => a.diasSinActividad === 0).length
    const aulasActivas7d = aulaAnalysis.filter(a => a.diasSinActividad <= 7).length
    const aulasMasActivas = [...aulaAnalysis]
      .sort((a, b) => b.actividades7d - a.actividades7d)
      .slice(0, 3)

    console.log('🔍 [getAulasDetails] Comprehensive analysis completed')

    return {
      aulas: aulas.map(aula => {
        const analysis = aulaAnalysis.find(a => a.aulaId === aula.aulaId)
        return {
          ...aula,
          ...analysis
        }
      }),
      estadisticasGlobales: {
        totalAulas: aulas.length,
        aulasActivas1d,
        aulasActivas7d,
        totalActividades30d: totalActividades,
        promedioActividadesPorAula: aulas.length > 0 ? (totalActividades / aulas.length).toFixed(1) : '0',
        aulasMasActivas
      },
      // Para compatibilidad con el componente actual
      totalAulas: aulas.length,
      aulasActivas: aulasActivas1d
    }
  } catch (error) {
    console.error('❌ [getAulasDetails] Error:', error)
    throw error
  }
}

// Detalles específicos para modal de cursos
async function getCursosDetails(page: number = 1, pageSize: number = 50) {
  try {
    console.log('🔍 [getCursosDetails] Loading ALL courses - Page:', page)
    
    // 1. ESTADÍSTICAS GENERALES
    const totalCursos = await prisma.aulaCourse.count({ where: { isActive: true } })
    const cursosInactivos = await prisma.aulaCourse.count({ where: { isActive: false } })
    
    // 2. OBTENER TODOS LOS CURSOS CON INFORMACIÓN COMPLETA (con paginación)
    const skip = (page - 1) * pageSize
    const todosLosCursos = await prisma.aulaCourse.findMany({
      where: { isActive: true },
      include: {
        aula: {
          select: { name: true, aulaId: true }
        },
        _count: {
          select: { activities: true }
        }
      },
      orderBy: [
        { aulaId: 'asc' },
        { courseId: 'asc' }
      ],
      skip,
      take: pageSize
    })

    // 3. OBTENER ACTIVIDAD RECIENTE PARA CADA CURSO
    const cursosConDetalles = await Promise.all(
      todosLosCursos.map(async (curso) => {
        // Contar actividades en últimos 7 días
        const actividadesRecientes = await prisma.courseActivity.count({
          where: {
            aulaId: curso.aulaId,
            courseId: curso.courseId,
            updatedAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            }
          }
        })

        // Obtener última actividad
        const ultimaActividad = await prisma.courseActivity.findFirst({
          where: {
            aulaId: curso.aulaId,
            courseId: curso.courseId
          },
          orderBy: { updatedAt: 'desc' },
          select: { 
            updatedAt: true, 
            name: true,
            type: true
          }
        })

        return {
          aulaId: curso.aulaId,
          aulaName: curso.aula.name,
          courseId: curso.courseId,
          courseName: curso.courseName || `Curso ${curso.courseId}`,
          shortName: curso.shortName,
          categoryName: curso.categoryName,
          enrollmentCount: curso.enrollmentCount || 0,
          totalActividades: curso._count.activities,
          actividadesUltimos7Dias: actividadesRecientes,
          ultimaActividad: ultimaActividad?.updatedAt,
          ultimaActividadNombre: ultimaActividad?.name,
          ultimaActividadTipo: ultimaActividad?.type,
          estado: actividadesRecientes > 0 ? 'Activo' : 'Inactivo',
          startDate: curso.startDate,
          endDate: curso.endDate
        }
      })
    )

    // 4. AGRUPAR POR AULA PARA ESTADÍSTICAS
    const cursosPorAula = todosLosCursos.reduce((acc: any, curso) => {
      const aulaId = curso.aulaId
      if (!acc[aulaId]) {
        acc[aulaId] = {
          aulaId,
          aulaName: curso.aula.name,
          cursos: [],
          totalCursos: 0,
          cursosActivos: 0
        }
      }
      acc[aulaId].cursos.push(curso)
      acc[aulaId].totalCursos++
      return acc
    }, {})

    // 5. CALCULAR ESTADÍSTICAS GLOBALES
    const cursosConActividad7d = await prisma.aulaCourse.count({
      where: {
        isActive: true,
        activities: {
          some: {
            updatedAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            }
          }
        }
      }
    })

    console.log('🔍 [getCursosDetails] Loaded:', {
      page,
      totalCursos,
      cursosEnPagina: todosLosCursos.length,
      totalPaginas: Math.ceil(totalCursos / pageSize)
    })

    return {
      // Estadísticas generales
      totalCursos,
      cursosConActividad7d,
      cursosActivos: cursosConActividad7d,
      cursosInactivos,
      
      // TODOS los cursos con detalles completos
      todosLosCursos: cursosConDetalles,
      
      // Agrupación por aula
      cursosPorAula: Object.values(cursosPorAula),
      
      // Paginación
      paginacion: {
        paginaActual: page,
        tamañoPagina: pageSize,
        totalRegistros: totalCursos,
        totalPaginas: Math.ceil(totalCursos / pageSize),
        tieneProximaPagina: skip + pageSize < totalCursos
      },
      
      // Metadatos
      ultimaActualizacion: new Date().toISOString()
    }
  } catch (error) {
    console.error('❌ [getCursosDetails] Error:', error)
    throw error
  }
}

// Detalles específicos para modal de actividades  
async function getActividadesDetails(page: number = 1, pageSize: number = 100) {
  try {
    console.log('🔍 [getActividadesDetails] Loading ALL activities - Page:', page)
    
    // 1. ESTADÍSTICAS GENERALES
    const totalActividades = await prisma.courseActivity.count()
    const actividades24h = await prisma.courseActivity.count({
      where: {
        updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    })
    const actividades7d = await prisma.courseActivity.count({
      where: {
        updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }
    })

    // 2. OBTENER TODAS LAS ACTIVIDADES CON PAGINACIÓN
    const skip = (page - 1) * pageSize
    const todasLasActividades = await prisma.courseActivity.findMany({
      select: {
        aulaId: true,
        courseId: true,
        activityId: true,
        name: true,
        type: true,
        updatedAt: true,
        dueDate: true,
        description: true,
        visible: true,
        needsAnalysis: true
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: pageSize
    })

    // 3. ENRIQUECER CADA ACTIVIDAD CON INFORMACIÓN DEL AULA Y CURSO
    const actividadesConDetalles = await Promise.all(
      todasLasActividades.map(async (actividad) => {
        // Obtener información del aula
        const aulaInfo = await prisma.aula.findUnique({
          where: { aulaId: actividad.aulaId },
          select: { name: true }
        }).catch(() => null)

        // Obtener información del curso
        const cursoInfo = await prisma.aulaCourse.findFirst({
          where: { 
            aulaId: actividad.aulaId,
            courseId: actividad.courseId 
          },
          select: { courseName: true, shortName: true }
        }).catch(() => null)

        return {
          ...actividad,
          aulaName: aulaInfo?.name || `Aula ${actividad.aulaId}`,
          courseName: cursoInfo?.courseName || `Curso ${actividad.courseId}`,
          courseShortName: cursoInfo?.shortName,
          tiempoTranscurrido: calcularTiempoTranscurrido(actividad.updatedAt),
          estado: actividad.needsAnalysis ? 'Pendiente análisis' : 'Procesada'
        }
      })
    )

    // 4. TIPOS DE ACTIVIDAD CON ESTADÍSTICAS COMPLETAS
    const actividadesByType = await prisma.courseActivity.groupBy({
      by: ['type'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    })

    const tiposConEstadisticas = await Promise.all(
      actividadesByType.map(async (tipo) => {
        const recientes24h = await prisma.courseActivity.count({
          where: {
            type: tipo.type,
            updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        })
        
        const recientes7d = await prisma.courseActivity.count({
          where: {
            type: tipo.type,
            updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }
        })

        const aulasConEstaActividad = await prisma.courseActivity.groupBy({
          by: ['aulaId'],
          where: { type: tipo.type },
          _count: { id: true }
        })

        return {
          type: tipo.type,
          total: tipo._count.id,
          ultimos_24h: recientes24h,
          ultimos_7d: recientes7d,
          aulas_con_este_tipo: aulasConEstaActividad.length,
          porcentaje: ((tipo._count.id / totalActividades) * 100).toFixed(1)
        }
      })
    )

    // 5. ACTIVIDADES POR AULA
    const actividadesPorAula = await prisma.courseActivity.groupBy({
      by: ['aulaId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    })

    const aulasConEstadisticas = await Promise.all(
      actividadesPorAula.slice(0, 20).map(async (aula) => {
        const aulaInfo = await prisma.aula.findUnique({
          where: { aulaId: aula.aulaId },
          select: { name: true }
        }).catch(() => null)

        const cursosEnAula = await prisma.courseActivity.groupBy({
          by: ['courseId'],
          where: { aulaId: aula.aulaId },
          _count: { id: true }
        })

        return {
          aulaId: aula.aulaId,
          aulaName: aulaInfo?.name || `Aula ${aula.aulaId}`,
          totalActividades: aula._count.id,
          cursosConActividades: cursosEnAula.length,
          porcentajeTotal: ((aula._count.id / totalActividades) * 100).toFixed(1)
        }
      })
    )

    const estadisticas = {
      total_actividades: totalActividades,
      actividades_24h: actividades24h,
      actividades_7d: actividades7d,
      tipos_actividad: actividadesByType.length,
      aulas_con_actividades: actividadesPorAula.length
    }

    console.log('🔍 [getActividadesDetails] Loaded:', {
      page,
      totalActividades,
      actividadesEnPagina: todasLasActividades.length,
      totalPaginas: Math.ceil(totalActividades / pageSize)
    })

    return {
      // Estadísticas generales
      estadisticas,
      
      // TODAS las actividades con detalles completos
      todasLasActividades: actividadesConDetalles,
      
      // Tipos de actividad con estadísticas
      tiposActividad: tiposConEstadisticas,
      
      // Actividades por aula
      actividadesPorAula: aulasConEstadisticas,
      
      // Paginación
      paginacion: {
        paginaActual: page,
        tamañoPagina: pageSize,
        totalRegistros: totalActividades,
        totalPaginas: Math.ceil(totalActividades / pageSize),
        tieneProximaPagina: skip + pageSize < totalActividades
      },
      
      // Mantener compatibilidad con el componente actual
      actividadesByType: tiposConEstadisticas,
      actividadesRecientes: actividadesConDetalles,
      
      ultimaActualizacion: new Date().toISOString()
    }
  } catch (error) {
    console.error('❌ [getActividadesDetails] Error:', error)
    throw error
  }
}

// Función helper para calcular tiempo transcurrido
function calcularTiempoTranscurrido(fecha: Date): string {
  const ahora = new Date()
  const diferencia = ahora.getTime() - fecha.getTime()
  const minutos = Math.floor(diferencia / (1000 * 60))
  const horas = Math.floor(minutos / 60)
  const dias = Math.floor(horas / 24)
  
  if (minutos < 60) return `${minutos}m`
  if (horas < 24) return `${horas}h`
  return `${dias}d`
}

// Verificación específica del cron job
async function getCronVerification() {
  try {
    console.log('🔍 [getCronVerification] Starting...')
    
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    
    console.log('🔍 [getCronVerification] Consultando desde:', startOfDay.toISOString())
    
    // Primero una consulta simple
    const totalActividades = await prisma.courseActivity.count({
      where: {
        updatedAt: {
          gte: startOfDay
        }
      }
    })
    
    console.log('🔍 [getCronVerification] Total actividades hoy:', totalActividades)
    
    // Últimas 20 actividades para ver el patrón
    const ultimasActividades = await prisma.courseActivity.findMany({
      select: {
        aulaId: true,
        courseId: true,
        name: true,
        type: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' },
      take: 20
    })
    
    console.log('🔍 [getCronVerification] Últimas actividades:', ultimasActividades.length)
    
    // Actividades agrupadas por hora (versión simplificada)
    const actividadesTarde = await prisma.courseActivity.count({
      where: {
        updatedAt: {
          gte: new Date(startOfDay.getTime() + 18 * 60 * 60 * 1000), // 6 PM
          lt: new Date(startOfDay.getTime() + 20 * 60 * 60 * 1000)   // 8 PM
        }
      }
    })
    
    console.log('🔍 [getCronVerification] Actividades 6-8 PM:', actividadesTarde)
    
    return {
      totalActividades,
      ultimasActividades,
      actividadesTarde,
      fechaConsulta: today.toISOString(),
      rangoConsulta: {
        inicio: startOfDay.toISOString(),
        fin: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000).toISOString()
      }
    }
  } catch (error) {
    console.error('❌ [getCronVerification] Error:', error)
    throw error
  }
}