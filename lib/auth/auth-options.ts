import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db/prisma'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { 
          label: "Email", 
          type: "email", 
          placeholder: "profesor@ejemplo.com" 
        },
        password: { 
          label: "Contraseña", 
          type: "password" 
        },
        matricula: { 
          label: "Matrícula", 
          type: "text", 
          placeholder: "MAT001" 
        }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password || !credentials?.matricula) {
          throw new Error('Por favor complete todos los campos')
        }

        try {
          // Buscar usuario por email
          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email.toLowerCase()
            }
          })

          if (!user) {
            throw new Error('Credenciales inválidas')
          }

          // Verificar que la matrícula coincida
          if (user.matricula !== credentials.matricula) {
            throw new Error('Matrícula incorrecta')
          }

          // Verificar contraseña
          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          )

          if (!isPasswordValid) {
            throw new Error('Contraseña incorrecta')
          }

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
      if (session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        session.user.matricula = token.matricula as string
        session.user.username = token.username as string
      }
      return session
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
