interface AnalysisListProps {
  title?: string
  items: string[]
  numbered?: boolean
  className?: string
}

export function AnalysisList({ title, items, numbered = false, className = "" }: AnalysisListProps) {
  return (
    <div className={`w-full ${className}`}>
      {title && (
        <h3 className="text-lg font-semibold text-primary-darker font-inter mb-4">
          {title}
        </h3>
      )}
      
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-1">
              {numbered ? (
                <div className="w-6 h-6 bg-green-100 text-primary-darker rounded-full flex items-center justify-center text-sm font-medium font-inter">
                  {index + 1}
                </div>
              ) : (
                <div className="w-2 h-2 bg-primary-darker rounded-full mt-2"></div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-neutral-dark font-inter text-sm leading-relaxed text-justify">
                {item}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}