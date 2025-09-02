'use client'

import { DynamicSection } from '@/types/analysis'
import { ContentParser } from './content-parser'
import { AnalysisList } from './analysis-list'
import { AnalysisTable } from './analysis-table'

interface DynamicSectionProps {
  section: DynamicSection
  className?: string
}

export function DynamicSectionRenderer({ section, className = "" }: DynamicSectionProps) {
  // Función para limpiar caracteres de markdown y especiales
  const cleanText = (text: string): string => {
    if (!text) return ''
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1')           // **texto** → texto
      .replace(/\*(.*?)\*/g, '$1')              // *texto* → texto
      .replace(/~(.*?)~/g, '$1')                // ~texto~ → texto
      .replace(/`(.*?)`/g, '$1')                // `texto` → texto
      .replace(/~(?=\d)/g, '')                  // Eliminar ~ que van antes de números (~59 → 59)
      .replace(/~/g, '')                        // Eliminar ~ restantes
      .replace(/\*\*Acción sugerida:\*\*/g, 'Acción sugerida:') // Casos específicos
      .replace(/\*Acción sugerida:\*/g, 'Acción sugerida:')
      .replace(/^\*\s+/gm, '')                  // * al inicio de línea
      .replace(/^\*\*\s+/gm, '')                // ** al inicio de línea
      .replace(/\*\*/g, '')                     // ** restantes
      .replace(/\*/g, '')                       // * restantes
      .trim()
  }

  // Mantener diseño consistente: fondo blanco, box-shadow-sm, border-radius 16px
  const getCardClasses = () => {
    return 'bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow'
  }

  const getHeaderColorClasses = () => {
    // Usar primary-darker para títulos de cards en dashboard
    return 'text-primary-darker font-inter'
  }

  const renderContent = () => {
    switch (section.format) {
      case 'table':
        if (typeof section.content === 'string') {
          return <ContentParser content={section.content} />
        }
        break

      case 'numbered-list':
        if (Array.isArray(section.content)) {
          // Limpiar caracteres de markdown para mejor presentación
          const cleanedContent = section.content.map((item: string) => cleanText(item))
          return <AnalysisList items={cleanedContent} numbered={true} />
        }
        break

      case 'bullet-list':
        if (Array.isArray(section.content)) {
          // Limpiar caracteres de markdown para mejor presentación
          const cleanedContent = section.content.map((item: string) => cleanText(item))
          return <AnalysisList items={cleanedContent} numbered={false} />
        }
        break

      case 'text':
        if (typeof section.content === 'string') {
          // Limpiar caracteres de markdown para mejor presentación
          const cleanedContent = cleanText(section.content)
          return (
            <div className="max-w-none text-neutral-dark font-inter text-sm">
              <ContentParser content={cleanedContent} />
            </div>
          )
        }
        break

      case 'cards':
        if (Array.isArray(section.content)) {
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.content.map((card: any, index: number) => (
                <div key={index} className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
                  <div className="text-sm font-medium text-neutral-dark font-inter">{card.title}</div>
                  <div className="text-2xl font-bold text-neutral-dark font-inter mt-1">
                    {card.value}
                    {card.unit && <span className="text-sm font-normal text-neutral-dark font-inter ml-1">{card.unit}</span>}
                  </div>
                  {card.trend && (
                    <div className={`text-xs mt-1 ${
                      card.trend === 'up' ? 'text-green-600' : 
                      card.trend === 'down' ? 'text-red-600' : 
                      'text-gray-600'
                    }`}>
                      {card.trend === 'up' ? '↗️ Tendencia positiva' : 
                       card.trend === 'down' ? '↘️ Requiere atención' : 
                       '➡️ Estable'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        }
        break

      case 'metrics':
        if (Array.isArray(section.content)) {
          return (
            <div className="space-y-3">
              {section.content.map((metric: any, index: number) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                  <span className="text-neutral-dark font-inter text-sm font-medium">{metric.label}</span>
                  <span className="text-neutral-dark font-inter text-sm font-semibold">
                    {metric.value}
                    {metric.unit && <span className="text-neutral-dark font-inter text-sm font-normal ml-1">{metric.unit}</span>}
                  </span>
                </div>
              ))}
            </div>
          )
        }
        break

      default:
        return (
          <div className="text-neutral-dark font-inter text-sm italic">
            Formato no soportado: {section.format}
          </div>
        )
    }

    return (
      <div className="text-neutral-dark font-inter text-sm italic">
        Contenido no válido para el formato {section.format}
      </div>
    )
  }

  return (
    <div className={`${getCardClasses()} p-6 ${className}`}>
      <div className="flex items-center space-x-2 mb-4">
        {section.icon && <span className="text-lg">{section.icon}</span>}
        <h3 className={`text-lg font-semibold ${getHeaderColorClasses()}`}>
          {section.title}
        </h3>
      </div>
      
      <div className="mt-4">
        {renderContent()}
      </div>
    </div>
  )
}