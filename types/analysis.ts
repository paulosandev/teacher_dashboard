// Tipos para análisis dinámico con formato flexible

export type SectionFormat = 'table' | 'numbered-list' | 'bullet-list' | 'text' | 'cards' | 'metrics'

export interface DynamicSection {
  id: string
  title: string
  format: SectionFormat
  content: any // El contenido varía según el formato
  priority?: number // Para ordenar las secciones
  icon?: string // Emoji o icono opcional
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray' // Color del card
}

export interface DynamicAnalysisResponse {
  summary: string
  sections: DynamicSection[]
  metadata?: {
    generatedAt: string
    confidence?: number
    model?: string
  }
}

// Ejemplos de contenido según formato:
// - table: string con formato "Header1 | Header2\nRow1Col1 | Row1Col2"
// - numbered-list: string[] con cada elemento
// - bullet-list: string[] con cada elemento
// - text: string con markdown
// - cards: { title: string, value: string | number, trend?: 'up' | 'down' | 'stable' }[]
// - metrics: { label: string, value: string | number, unit?: string }[]