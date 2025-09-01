import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { multiAulaAuthService } from './multi-aula-auth-service'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { 
          label: "Usuario/Matrícula Moodle", 
          type: "text", 
          placeholder: "cesar.espindola" 
        },
        password: { 
          label: "Contraseña Moodle", 
          type: "password" 
        }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error('Por favor ingrese usuario y contraseña de Moodle')
        }

        try {
          console.log(`🔐 Intentando autenticación multi-aula NextAuth para: ${credentials.username}`)

          // Autenticar usando el servicio multi-aula
          const authResult = await multiAulaAuthService.authenticateUser(
            credentials.username,
            credentials.password
          )

          if (!authResult.success || !authResult.user) {
            console.log(`❌ Autenticación multi-aula fallida: ${authResult.error}`)
            throw new Error(authResult.error || 'Credenciales inválidas')
          }

          const statusMessage = multiAulaAuthService.getStatusMessage(authResult)
          console.log(`✅ Autenticación multi-aula exitosa: ${statusMessage}`)

          // Obtener la URL del aula principal (primera aula válida)
          const primaryAulaUrl = authResult.aulaResults && authResult.aulaResults.length > 0
            ? authResult.aulaResults.find(a => a.isValidCredentials)?.aulaUrl || 'https://av141.utel.edu.mx'
            : 'https://av141.utel.edu.mx'
          
          // Retornar datos del usuario para la sesión
          return {
            id: authResult.user.id.toString(),
            email: authResult.user.email,
            name: authResult.user.fullname,
            matricula: authResult.user.username,
            username: authResult.user.username,
            moodleToken: authResult.primaryToken,
            moodleUrl: primaryAulaUrl, // Agregar URL del aula principal
            tokenExpiry: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
            multiAulaData: {
              totalAulas: authResult.totalAulas,
              validAulas: authResult.validAulas,
              invalidAulas: authResult.invalidAulas,
              aulaResults: authResult.aulaResults,
              validTokens: multiAulaAuthService.getValidTokens(authResult.aulaResults)
            }
          }
        } catch (error: any) {
          console.error('❌ Error en autenticación Moodle:', error)
          throw new Error(error.message || 'Error de autenticación')
        }
      }
    })
  ],
  
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.moodleUrl = user.moodleUrl
        token.email = user.email
        token.matricula = user.matricula
        token.username = user.username
        token.moodleToken = user.moodleToken
        token.tokenExpiry = user.tokenExpiry
        token.multiAulaData = user.multiAulaData
      }

      // Validar expiración del token de Moodle
      if (token.tokenExpiry && new Date() > new Date(token.tokenExpiry as string)) {
        console.log(`⚠️ Token de Moodle expirado para usuario: ${token.username}`)
        // El token ha expirado, se necesita re-autenticación
        return null
      }

      // Opcionalmente, validar el token contra Moodle cada cierto tiempo
      // (por ahora, confiamos en la expiración calculada)
      
      return token
    },
    
    async session({ session, token }) {
      if (session.user && token.id) {
        // No consultamos BD, usamos solo datos del token
        session.user.id = token.id as string
        session.user.email = token.email as string
        session.user.matricula = token.matricula as string
        session.user.username = token.username as string
        session.user.name = token.name as string
        session.user.moodleToken = token.moodleToken as string
        session.user.moodleUrl = token.moodleUrl as string
        session.user.tokenExpiry = token.tokenExpiry as Date
        session.user.multiAulaData = token.multiAulaData as any
      }
      return session
    },
    
    async redirect({ url, baseUrl }) {
      // Si es una redirección después del login exitoso, ir a dashboard v2
      if (url === baseUrl || url === baseUrl + '/dashboard') {
        return baseUrl + '/dashboard/v2'
      }
      
      // Si la URL ya es absoluta y está en el mismo dominio, usarla
      if (url.startsWith(baseUrl)) {
        return url
      }
      
      // Para rutas relativas, construir URL completa
      if (url.startsWith('/')) {
        return baseUrl + url
      }
      
      // Por defecto, ir a dashboard v2
      return baseUrl + '/dashboard/v2'
    }
  },
  
  pages: {
    signIn: '/auth/login',
    signOut: '/auth/logout',
    error: '/auth/error',
  },
  
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },
  
  debug: false,
}
