import { AnalysisTable } from './analysis-table'
import { AnalysisList } from './analysis-list'
import { FormattedText } from './formatted-text'

interface ContentSection {
  type: 'table' | 'numbered-list' | 'bullet-list' | 'text'
  content: any
  title?: string
}

interface ContentParserProps {
  content: string
  className?: string
}

export function ContentParser({ content, className = "" }: ContentParserProps) {
  const sections = parseContent(content)
  
  return (
    <div className={`space-y-6 ${className}`}>
      {sections.map((section, index) => (
        <div key={index}>
          {renderSection(section)}
        </div>
      ))}
    </div>
  )
}

function parseContent(content: string): ContentSection[] {
  const sections: ContentSection[] = []
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  
  let currentSection: string[] = []
  let currentType: ContentSection['type'] | null = null
  let currentTitle: string | undefined

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const nextLine = lines[i + 1]
    
    // Detectar título de tabla (seguido de línea con indicadores)
    if (nextLine && isTableHeader(nextLine)) {
      if (currentSection.length > 0 && currentType) {
        sections.push(createSection(currentType, currentSection, currentTitle))
        currentSection = []
      }
      currentTitle = line
      currentType = 'table'
      i++ // Saltar la línea de header
      continue
    }
    
    // Detectar tabla (formato: indicador | valor)
    if (isTableRow(line)) {
      if (currentType !== 'table') {
        if (currentSection.length > 0 && currentType) {
          sections.push(createSection(currentType, currentSection, currentTitle))
        }
        currentSection = []
        currentType = 'table'
        currentTitle = undefined
      }
      currentSection.push(line)
      continue
    }
    
    // Detectar lista numerada
    if (isNumberedListItem(line)) {
      if (currentType !== 'numbered-list') {
        if (currentSection.length > 0 && currentType) {
          sections.push(createSection(currentType, currentSection, currentTitle))
        }
        currentSection = []
        currentType = 'numbered-list'
        currentTitle = undefined
      }
      currentSection.push(line.replace(/^\d+\.?\s*/, ''))
      continue
    }
    
    // Detectar lista con bullets
    if (isBulletListItem(line)) {
      if (currentType !== 'bullet-list') {
        if (currentSection.length > 0 && currentType) {
          sections.push(createSection(currentType, currentSection, currentTitle))
        }
        currentSection = []
        currentType = 'bullet-list'
        currentTitle = undefined
      }
      currentSection.push(line.replace(/^[-•*]\s*/, ''))
      continue
    }
    
    // Texto normal
    if (currentType !== 'text') {
      if (currentSection.length > 0 && currentType) {
        sections.push(createSection(currentType, currentSection, currentTitle))
      }
      currentSection = []
      currentType = 'text'
      currentTitle = undefined
    }
    currentSection.push(line)
  }
  
  // Agregar última sección
  if (currentSection.length > 0 && currentType) {
    sections.push(createSection(currentType, currentSection, currentTitle))
  }
  
  return sections
}

function isTableHeader(line: string): boolean {
  return line.toLowerCase().includes('indicador') && line.toLowerCase().includes('valor')
}

function isTableRow(line: string): boolean {
  // Detectar formato: "algo | algo" o "algo: algo"
  return /^[^|:]+(\||:)[^|:]+$/.test(line)
}

function isNumberedListItem(line: string): boolean {
  return /^\d+\.?\s+/.test(line)
}

function isBulletListItem(line: string): boolean {
  return /^[-•*]\s+/.test(line)
}

function createSection(type: ContentSection['type'], content: string[], title?: string): ContentSection {
  switch (type) {
    case 'table':
      return {
        type: 'table',
        title,
        content: content.map(line => {
          const parts = line.split(/\||:/).map(part => part.trim())
          return {
            indicator: parts[0] || '',
            value: parts[1] || ''
          }
        })
      }
    case 'numbered-list':
    case 'bullet-list':
      return {
        type,
        content
      }
    case 'text':
      return {
        type: 'text',
        content: content.join('\n\n')
      }
  }
}

function renderSection(section: ContentSection) {
  switch (section.type) {
    case 'table':
      return (
        <AnalysisTable
          title={section.title}
          data={section.content}
        />
      )
    case 'numbered-list':
      return (
        <AnalysisList
          items={section.content}
          numbered={true}
        />
      )
    case 'bullet-list':
      return (
        <AnalysisList
          items={section.content}
          numbered={false}
        />
      )
    case 'text':
      return (
        <FormattedText content={section.content} />
      )
  }
}