import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { autoUpdateService } from '@/lib/services/auto-update-service'
import { processStateService } from '@/lib/services/process-state-service'

// Use global prisma instance to avoid connection issues
declare global {
  var prisma: PrismaClient | undefined
}

const prisma = globalThis.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma

export async function GET() {
  try {
    console.log('📊 [STATUS] Consultando estado del sistema batch')

    // Obtener estadísticas generales más simples
    const totalActivities = await prisma.courseActivity.count()
    const activitiesNeedingAnalysis = await prisma.courseActivity.count({
      where: { needsAnalysis: true }
    })

    // Estadísticas por aula más simples
    const aulaStats = await prisma.aula.findMany({
      select: {
        aulaId: true,
        name: true,
        lastSync: true,
        _count: {
          select: {
            courses: true
          }
        }
      }
    })

    // Por ahora usar valores simplificados
    const aulaAnalysisMap = {} as Record<string, number>

    // Procesar estadísticas detalladas
    const detailedStats = aulaStats.map(aula => {      
      return {
        aulaId: aula.aulaId,
        name: aula.name,
        coursesCount: aula._count.courses,
        activitiesCount: 0, // Simplificado por ahora
        analyzedCount: aulaAnalysisMap[aula.aulaId] || 0,
        pendingCount: 0, // Simplificado por ahora
        lastSync: aula.lastSync,
        completionPercentage: 0 // Simplificado por ahora
      }
    })

    // Análisis recientes simplificados por ahora
    const recentAnalyses = [] as any[]

    // Obtener estado real del servicio de actualización y proceso compartido
    const updateServiceStatus = autoUpdateService.getStatus()
    const processState = await processStateService.getState()
    const progressPercentage = await processStateService.getProgressPercentage()
    const elapsedTime = await processStateService.getElapsedTime()

    // Obtener hora en zona horaria de México
    const mexicoTime = new Date().toLocaleString('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(', ', 'T') + '-06:00'

    const response = {
      success: true,
      timestamp: mexicoTime,
      summary: {
        totalActivities,
        analyzedActivities: totalActivities - activitiesNeedingAnalysis, // Calculado
        pendingActivities: activitiesNeedingAnalysis,
        completionPercentage: totalActivities > 0 
          ? Math.round(((totalActivities - activitiesNeedingAnalysis) / totalActivities) * 100) 
          : 0
      },
      aulaBreakdown: detailedStats,
      recentAnalyses,
      systemStatus: {
        isProcessing: processState.isActive || updateServiceStatus.isUpdating || activitiesNeedingAnalysis > 0,
        totalAulas: aulaStats.length,
        lastUpdate: processState.lastUpdate ? 
          new Date(processState.lastUpdate).toLocaleString('en-CA', {
            timeZone: 'America/Mexico_City',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          }).replace(', ', 'T') + '-06:00' : mexicoTime,
        updateService: updateServiceStatus
      },
      // Agregar información detallada del proceso actual
      processDetails: {
        isActive: processState.isActive,
        processType: processState.processType,
        currentStep: processState.currentStep,
        progress: {
          aulas: {
            total: processState.totalAulas,
            processed: processState.processedAulas,
            current: processState.currentAula,
            percentage: progressPercentage
          },
          courses: {
            total: processState.totalCourses,
            processed: processState.processedCourses
          },
          analysis: {
            total: processState.totalAnalysis,
            processed: processState.processedAnalysis
          }
        },
        timing: {
          startTime: processState.startTime ? 
            new Date(processState.startTime).toLocaleString('en-CA', {
              timeZone: 'America/Mexico_City',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            }).replace(', ', 'T') + '-06:00' : null,
          elapsedTime,
          estimatedCompletion: processState.estimatedCompletion ?
            new Date(processState.estimatedCompletion).toLocaleString('en-CA', {
              timeZone: 'America/Mexico_City',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            }).replace(', ', 'T') + '-06:00' : null
        },
        errors: processState.errors
      }
    }

    console.log(`✅ [STATUS] Estado consultado: ${totalActivities - activitiesNeedingAnalysis}/${totalActivities} análisis completados`)
    
    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ [STATUS] Error consultando estado:', error)
    
    // Obtener hora en zona horaria de México para errores también
    const mexicoTime = new Date().toLocaleString('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(', ', 'T') + '-06:00'

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: mexicoTime
    }, { status: 500 })
  }
}