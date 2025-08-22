'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertTriangle, Users, Target, TrendingUp } from "lucide-react"
import { AnalysisList } from "@/components/ui/analysis-list"
import { ContentParser } from "@/components/ui/content-parser"

interface AnalysisInsightsProps {
  analysisData: {
    strengths?: string[]
    alerts?: string[]
    studentsAtRisk?: string
    recommendations?: string[]
    nextStep?: string
    overallHealth?: 'buena' | 'regular' | 'necesita atención'
    metricsTable?: string
    structuredInsights?: {
      numbered?: string[]
      bullets?: string[]
    }
  }
}

export function AnalysisInsightsCard({ analysisData }: AnalysisInsightsProps) {
  const {
    strengths = [],
    alerts = [],
    studentsAtRisk = 'No determinado',
    recommendations = [],
    nextStep = 'Continuar monitoreo',
    overallHealth = 'regular',
    metricsTable,
    structuredInsights
  } = analysisData

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'buena':
        return 'text-green-700 bg-green-100 border-green-200'
      case 'regular':
        return 'text-yellow-700 bg-yellow-100 border-yellow-200'
      case 'necesita atención':
        return 'text-red-700 bg-red-100 border-red-200'
      default:
        return 'text-gray-700 bg-gray-100 border-gray-200'
    }
  }

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'buena':
        return <TrendingUp className="h-4 w-4" />
      case 'regular':
        return <Target className="h-4 w-4" />
      case 'necesita atención':
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <Target className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Tabla de métricas mejorada */}
      {metricsTable && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Panorama general de la participación</CardTitle>
          </CardHeader>
          <CardContent>
            <ContentParser content={metricsTable} />
          </CardContent>
        </Card>
      )}

      {/* Insights estructurados */}
      {structuredInsights && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Insights clave para la evaluación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {structuredInsights.numbered && (
              <AnalysisList
                items={structuredInsights.numbered}
                numbered={true}
              />
            )}
            
            {structuredInsights.bullets && (
              <AnalysisList
                title={structuredInsights.numbered ? "Observaciones adicionales" : undefined}
                items={structuredInsights.bullets}
                numbered={false}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Estado general del curso */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Estado General del Curso</CardTitle>
            <Badge variant="outline" className={`${getHealthColor(overallHealth)} border`}>
              {getHealthIcon(overallHealth)}
              <span className="ml-1 capitalize">{overallHealth}</span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Estudiantes en riesgo:</span>
              <span className="text-gray-600">{studentsAtRisk}</span>
            </div>
            
            {nextStep && (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-blue-700 font-medium mb-2">
                  <Target className="h-4 w-4" />
                  Próximo Paso Prioritario
                </div>
                <p className="text-blue-600 text-sm">{nextStep}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fortalezas */}
      {strengths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              Fortalezas Identificadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AnalysisList
              items={strengths}
              numbered={false}
            />
          </CardContent>
        </Card>
      )}

      {/* Alertas */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Alertas Críticas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AnalysisList
              items={alerts}
              numbered={false}
            />
          </CardContent>
        </Card>
      )}

      {/* Recomendaciones */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <Target className="h-5 w-5" />
              Recomendaciones Específicas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AnalysisList
              items={recommendations}
              numbered={true}
            />
          </CardContent>
        </Card>
      )}

      {/* Mensaje cuando no hay datos */}
      {strengths.length === 0 && alerts.length === 0 && recommendations.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <Target className="h-12 w-12 mx-auto mb-4" />
            </div>
            <p className="text-gray-500">
              No hay insights disponibles. Ejecuta un análisis para ver recomendaciones detalladas.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
