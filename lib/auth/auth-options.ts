import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db/prisma'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        login: { 
          label: "Email o Matrícula", 
          type: "text", 
          placeholder: "cesar.espindola o profesor@ejemplo.com" 
        },
        password: { 
          label: "Contraseña", 
          type: "password" 
        }
      },
      async authorize(credentials) {
        if (!credentials?.login || !credentials?.password) {
          throw new Error('Por favor ingrese login y contraseña')
        }

        try {
          // Buscar usuario por email, username O matrícula
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { email: credentials.login.toLowerCase() },
                { username: credentials.login.toLowerCase() },
                { matricula: credentials.login.toLowerCase() }
              ]
            }
          })

          if (!user) {
            console.log(`Usuario no encontrado: ${credentials.login}`)
            throw new Error('Credenciales inválidas')
          }

          // Verificar contraseña
          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          )

          if (!isPasswordValid) {
            console.log(`Contraseña incorrecta para usuario: ${credentials.login}`)
            throw new Error('Contraseña incorrecta')
          }

          console.log(`✅ Login exitoso para: ${user.name} (${user.matricula})`)

          // Retornar datos del usuario para la sesión
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            matricula: user.matricula,
            username: user.username
          }
        } catch (error) {
          console.error('Error en autenticación:', error)
          return null
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
      }
      return token
    },
    
    async session({ session, token }) {
      if (session.user && token.id) {
        // Buscar los datos actuales del usuario en la BD para asegurar consistencia
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { 
            id: true, 
            email: true, 
            matricula: true, 
            username: true, 
            name: true 
          }
        })

        if (dbUser) {
          session.user.id = dbUser.id
          session.user.email = dbUser.email
          session.user.matricula = dbUser.matricula
          session.user.username = dbUser.username || ''
          session.user.name = dbUser.name
        } else {
          // Si no se encuentra el usuario, usar datos del token como fallback
          session.user.id = token.id as string
          session.user.email = token.email as string
          session.user.matricula = token.matricula as string
          session.user.username = token.username as string
        }
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
