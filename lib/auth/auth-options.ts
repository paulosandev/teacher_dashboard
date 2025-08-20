import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { moodleAuthService } from './moodle-auth-service'

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
          console.log(`🔐 Intentando autenticación NextAuth para: ${credentials.username}`)

          // Autenticar directamente contra Moodle
          const authResult = await moodleAuthService.authenticateUser(
            credentials.username,
            credentials.password
          )

          if (!authResult.success || !authResult.user) {
            console.log(`❌ Autenticación fallida: ${authResult.error}`)
            throw new Error(authResult.error || 'Credenciales inválidas')
          }

          if (!authResult.isTeacher) {
            console.log(`❌ Usuario no es profesor: ${credentials.username}`)
            throw new Error('Acceso restringido a profesores únicamente')
          }

          console.log(`✅ Autenticación exitosa para profesor: ${authResult.user.fullname}`)

          // Retornar datos del usuario para la sesión
          return {
            id: authResult.user.id.toString(),
            email: authResult.user.email,
            name: authResult.user.fullname,
            matricula: authResult.user.username,
            username: authResult.user.username,
            moodleToken: authResult.token,
            tokenExpiry: authResult.tokenExpiry
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
        token.email = user.email
        token.matricula = user.matricula
        token.username = user.username
        token.moodleToken = user.moodleToken
        token.tokenExpiry = user.tokenExpiry
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
        session.user.tokenExpiry = token.tokenExpiry as Date
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
