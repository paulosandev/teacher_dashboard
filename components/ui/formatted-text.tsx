interface FormattedTextProps {
  content: string
  className?: string
}

export function FormattedText({ content, className = "" }: FormattedTextProps) {
  // Dividir el contenido en párrafos
  const paragraphs = content
    .split(/\n\s*\n/)
    .filter(p => p.trim().length > 0)
    .map(p => p.trim())

  if (paragraphs.length === 0) {
    return null
  }

  // Si solo hay un párrafo, mostrarlo sin contenedor adicional
  if (paragraphs.length === 1) {
    return (
      <p className={`text-gray-700 leading-relaxed ${className}`}>
        {paragraphs[0]}
      </p>
    )
  }

  // Múltiples párrafos
  return (
    <div className={`space-y-3 ${className}`}>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="text-gray-700 leading-relaxed">
          {paragraph}
        </p>
      ))}
    </div>
  )
}