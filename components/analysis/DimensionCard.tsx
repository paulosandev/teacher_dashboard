'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertTriangle, Lightbulb, Target } from 'lucide-react'

interface DimensionCardProps {
  title: string
  content: string
  index: number
}

export function DimensionCard({ title, content, index }: DimensionCardProps) {
  // Extraer puntos principales y acción sugerida
  const lines = content.split('\n').filter(line => line.trim().length > 0)
  const bulletPoints = lines
    .filter(line => line.trim().startsWith('*') || line.trim().startsWith('-'))
    .map(line => line.replace(/^[\*\-]\s*/, '').trim())
    .filter(point => point.length > 0 && !point.toLowerCase().includes('acción sugerida'))

  const actionLine = lines.find(line => line.toLowerCase().includes('acción sugerida'))
  const action = actionLine ? actionLine.replace(/^\*\*.*?\*\*:?\s*/, '').trim() : ''

  // Determinar icono y color basado en el tipo de dimensión
  const getIconAndColor = (title: string) => {
    const lowerTitle = title.toLowerCase()
    if (lowerTitle.includes('participación') || lowerTitle.includes('engagement')) {
      return { icon: Target, color: 'text-blue-600', bgColor: 'bg-blue-50' }
    } else if (lowerTitle.includes('problema') || lowerTitle.includes('riesgo') || lowerTitle.includes('alerta')) {
      return { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-50' }
    } else if (lowerTitle.includes('oportunidad') || lowerTitle.includes('mejora')) {
      return { icon: Lightbulb, color: 'text-yellow-600', bgColor: 'bg-yellow-50' }
    } else {
      return { icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-50' }
    }
  }

  const { icon: Icon, color, bgColor } = getIconAndColor(title)

  return (
    <Card className="h-full">
      <CardHeader className={`${bgColor} rounded-t-lg`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full bg-white ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <CardTitle className={`text-lg ${color}`}>{title}</CardTitle>
            <Badge variant="secondary" className="text-xs">
              Dimensión {index + 1}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {/* Hallazgos clave */}
        <div className="space-y-3 mb-6">
          <h4 className="font-medium text-gray-700 text-sm uppercase tracking-wide">
            Hallazgos clave
          </h4>
          <div className="space-y-2">
            {bulletPoints.map((point, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="w-2 h-2 bg-gray-400 rounded-full mt-2 flex-shrink-0"></div>
                <p 
                  className="text-sm text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ 
                    __html: point.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Acción sugerida */}
        {action && (
          <div className={`p-4 rounded-lg border-l-4 ${bgColor}`} style={{borderLeftColor: color.replace('text-', '#')}}>
            <h4 className="font-semibold text-gray-800 text-sm mb-2">
              🎯 Acción sugerida
            </h4>
            <p 
              className="text-sm text-gray-700"
              dangerouslySetInnerHTML={{ 
                __html: action.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}