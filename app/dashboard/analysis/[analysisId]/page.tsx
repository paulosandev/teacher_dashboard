import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { AnalysisDetailView } from '@/components/analysis/AnalysisDetailView'

interface AnalysisDetailPageProps {
  params: {
    analysisId: string
  }
}

async function getAnalysisData(analysisId: string) {
  try {
    const analysis = await prisma.analysisResult.findUnique({
      where: {
        id: analysisId,
        isLatest: true
      },
      include: {
        course: true,
        group: true
      }
    })

    if (!analysis) {
      return null
    }

    // Transformar datos de Prisma al formato que esperan los componentes
    return {
      id: analysis.id,
      title: `Análisis de ${analysis.course.name}${analysis.group ? ` - ${analysis.group.name}` : ''}`,
      type: analysis.analysisType === 'INTELLIGENT_ANALYSIS' ? 'forum' as const : 'activity' as const,
      courseId: analysis.courseId,
      moodleCourseId: analysis.moodleCourseId,
      groupId: analysis.groupId,
      strengths: Array.isArray(analysis.strengths) 
        ? (analysis.strengths as any[]).map((s, index) => ({
            id: `strength-${index}`,
            description: typeof s === 'string' ? s : s.description || s,
            evidence: typeof s === 'object' && s.evidence ? s.evidence : undefined
          }))
        : [],
      alerts: Array.isArray(analysis.alerts)
        ? (analysis.alerts as any[]).map((a, index) => ({
            id: `alert-${index}`,
            description: typeof a === 'string' ? a : a.description || a,
            severity: typeof a === 'object' && a.severity ? a.severity : 'medium'
          }))
        : [],
      nextStep: {
        id: 'next-step',
        action: analysis.nextStep || 'Continuar monitoreo'
      },
      lastUpdated: analysis.processedAt,
      confidence: analysis.confidence || undefined,
      rawData: analysis.rawData as any,
      llmResponse: analysis.llmResponse as any,
      // Campos específicos para el análisis
      courseName: analysis.course.name,
      groupName: analysis.group?.name,
      analyzedBy: analysis.analyzedBy,
      analyzedByName: analysis.analyzedByName,
      analysisType: analysis.analysisType,
      studentsAnalyzed: analysis.studentsAnalyzed,
      activitiesCount: analysis.activitiesCount,
      forumsCount: analysis.forumsCount,
      overallHealth: analysis.overallHealth,
      studentsAtRisk: analysis.studentsAtRisk
    }
  } catch (error) {
    console.error('Error obteniendo datos del análisis:', error)
    return null
  }
}

export default async function AnalysisDetailPage({ params }: AnalysisDetailPageProps) {
  const analysisData = await getAnalysisData(params.analysisId)

  if (!analysisData) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnalysisDetailView data={analysisData} />
      </div>
    </div>
  )
}