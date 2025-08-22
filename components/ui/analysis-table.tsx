interface AnalysisTableRow {
  indicator: string
  value: string | number
}

interface AnalysisTableProps {
  title?: string
  data: AnalysisTableRow[]
  className?: string
}

export function AnalysisTable({ title, data, className = "" }: AnalysisTableProps) {
  return (
    <div className={`w-full ${className}`}>
      {title && (
        <h3 className="text-lg font-semibold text-primary-darker font-inter mb-4">
          {title}
        </h3>
      )}
      
      <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
        <table className="w-full">
          <thead>
            <tr>
              <th className="bg-primary-darker text-white px-4 py-3 text-left font-medium font-inter text-sm">
                Indicador
              </th>
              <th className="bg-primary-darker text-white px-4 py-3 text-center font-medium font-inter text-sm">
                Valor observado
              </th>
            </tr>
          </thead>
          <tbody>
            {data
              .filter((row, index) => {
                // Filtrar filas con solo guiones, contenido vacío o redundante
                const indicatorStr = row.indicator.toString().trim();
                const valueStr = row.value.toString().trim();
                
                // Eliminar filas que:
                // - Solo contienen guiones
                // - Están vacías
                // - Son encabezados redundantes
                // - Contienen solo caracteres especiales
                if (indicatorStr.match(/^-+$/) || valueStr.match(/^-+$/)) return false;
                if (indicatorStr === '' || valueStr === '') return false;
                if (indicatorStr === 'Parámetro' || valueStr === 'Valor') return false;
                if (indicatorStr === 'Indicador' || valueStr === 'Valor observado') return false;
                
                return true;
              })
              .map((row, index) => (
                <tr 
                  key={index}
                  className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="px-4 py-3 text-neutral-dark font-inter text-sm border-t border-gray-100">
                    {row.indicator}
                  </td>
                  <td className="px-4 py-3 text-neutral-dark font-inter text-sm text-center border-t border-gray-100 font-medium">
                    {row.value}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}