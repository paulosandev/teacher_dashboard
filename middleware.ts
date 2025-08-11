import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    // Lógica adicional del middleware si es necesaria
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Rutas que requieren autenticación
        const protectedPaths = ['/dashboard', '/api/analysis', '/api/courses']
        const path = req.nextUrl.pathname
        
        // Verificar si la ruta actual requiere autenticación
        const isProtected = protectedPaths.some(p => path.startsWith(p))
        
        if (isProtected) {
          return !!token // Requiere token válido
        }
        
        return true // Permitir acceso a rutas públicas
      }
    },
    pages: {
      signIn: '/auth/login',
      error: '/auth/error',
    }
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/analysis/:path*',
    '/api/courses/:path*',
  ]
}
