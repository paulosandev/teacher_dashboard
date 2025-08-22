'use client'

import { ArrowLeft, Clock, User, Building } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AnalysisTable } from '@/components/ui/analysis-table'
import { AnalysisList } from '@/components/ui/analysis-list'
import { ContentParser } from '@/components/ui/content-parser'
import { FormattedText } from '@/components/ui/formatted-text'

interface AnalysisDetailData {
  id: string
  title: string
  type: 'activity' | 'forum'
  courseName: string
  groupName?: string
  analyzedBy: string
  analyzedByName?: string
  analysisType: string
  lastUpdated: Date
  confidence?: number
  strengths: Array<{ id: string; description: string; evidence?: string }>
  alerts: Array<{ id: string; description: string; severity: string }>
  nextStep: { id: string; action: string }
  overallHealth?: string
  studentsAtRisk?: string
  studentsAnalyzed?: number
  activitiesCount?: number
  forumsCount?: number
  rawData?: any
  llmResponse?: any
}

interface AnalysisDetailViewProps {
  data: AnalysisDetailData
}

export function AnalysisDetailView({ data }: AnalysisDetailViewProps) {
  const router = useRouter()

  const getHealthColor = (health?: string) => {
    switch (health) {
      case 'buena':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'regular':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'necesita atención':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver al Dashboard</span>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.title}</h1>
            <p className="text-gray-600">Análisis detallado del curso</p>
          </div>
        </div>
        {data.confidence && (
          <Badge variant="outline" className="text-sm">
            Confianza: {Math.round(data.confidence * 100)}%
          </Badge>
        )}
      </div>

      {/* Información general */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building className="h-5 w-5" />
            <span>Información General</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center space-x-2">
              <Building className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm font-medium">Curso</p>
                <p className="text-sm text-gray-600">{data.courseName}</p>
              </div>
            </div>
            {data.groupName && (
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium">Grupo</p>
                  <p className="text-sm text-gray-600">{data.groupName}</p>
                </div>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm font-medium">Analizado</p>
                <p className="text-sm text-gray-600">
                  {new Date(data.lastUpdated).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
            {data.overallHealth && (
              <div className="flex items-center space-x-2">
                <div className="h-4 w-4 rounded-full bg-current opacity-20"></div>
                <div>
                  <p className="text-sm font-medium">Estado</p>
                  <Badge className={getHealthColor(data.overallHealth)}>
                    {data.overallHealth}
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Métricas principales */}
      {data.llmResponse?.metricsTable && (
        <Card>
          <CardHeader>
            <CardTitle>Panorama General de la Participación</CardTitle>
          </CardHeader>
          <CardContent>
            <ContentParser content={data.llmResponse.metricsTable} />
          </CardContent>
        </Card>
      )}

      {/* Insights estructurados */}
      {data.llmResponse?.structuredInsights && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {data.llmResponse.structuredInsights.numbered && (
            <Card>
              <CardHeader>
                <CardTitle>Insights Clave para la Evaluación</CardTitle>
              </CardHeader>
              <CardContent>
                <AnalysisList
                  items={data.llmResponse.structuredInsights.numbered}
                  numbered={true}
                />
              </CardContent>
            </Card>
          )}
          
          {data.llmResponse.structuredInsights.bullets && (
            <Card>
              <CardHeader>
                <CardTitle>Observaciones Adicionales</CardTitle>
              </CardHeader>
              <CardContent>
                <AnalysisList
                  items={data.llmResponse.structuredInsights.bullets}
                  numbered={false}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Fortalezas y Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fortalezas */}
        {data.strengths.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-green-700">Fortalezas Identificadas</CardTitle>
            </CardHeader>
            <CardContent>
              <AnalysisList
                items={data.strengths.map(s => s.evidence ? `${s.description} (${s.evidence})` : s.description)}
                numbered={false}
              />
            </CardContent>
          </Card>
        )}

        {/* Alertas */}
        {data.alerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-red-700">Alertas Críticas</CardTitle>
            </CardHeader>
            <CardContent>
              <AnalysisList
                items={data.alerts.map(a => a.description)}
                numbered={false}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recomendaciones */}
      {data.llmResponse?.recommendations && data.llmResponse.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-700">Recomendaciones Específicas</CardTitle>
          </CardHeader>
          <CardContent>
            <AnalysisList
              items={data.llmResponse.recommendations}
              numbered={true}
            />
          </CardContent>
        </Card>
      )}

      {/* Estudiantes en riesgo */}
      {data.studentsAtRisk && (
        <Card>
          <CardHeader>
            <CardTitle className="text-orange-700">Estudiantes en Riesgo</CardTitle>
          </CardHeader>
          <CardContent>
            <FormattedText content={data.studentsAtRisk} />
          </CardContent>
        </Card>
      )}

      {/* Próximo paso */}
      <Card>
        <CardHeader>
          <CardTitle className="text-purple-700">Próximo Paso Prioritario</CardTitle>
        </CardHeader>
        <CardContent>
          <FormattedText content={data.nextStep.action} />
        </CardContent>
      </Card>

      {/* Información técnica */}
      <Card>
        <CardHeader>
          <CardTitle>Información Técnica del Análisis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="font-medium text-gray-700">Tipo de Análisis</p>
              <p className="text-gray-600">{data.analysisType}</p>
            </div>
            <div>
              <p className="font-medium text-gray-700">Analizado por</p>
              <p className="text-gray-600">{data.analyzedByName || data.analyzedBy}</p>
            </div>
            {data.studentsAnalyzed && (
              <div>
                <p className="font-medium text-gray-700">Estudiantes</p>
                <p className="text-gray-600">{data.studentsAnalyzed}</p>
              </div>
            )}
            {data.forumsCount && (
              <div>
                <p className="font-medium text-gray-700">Foros</p>
                <p className="text-gray-600">{data.forumsCount}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}