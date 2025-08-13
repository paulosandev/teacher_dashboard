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
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Por favor ingrese email y contraseña')
        }

        try {
          // Buscar usuario por email O username
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { email: credentials.email.toLowerCase() },
                { username: credentials.email.toLowerCase() }
              ]
            }
          })

          if (!user) {
            console.log(`Usuario no encontrado: ${credentials.email}`)
            throw new Error('Credenciales inválidas')
          }

          // Verificar que la matrícula coincida (obligatorio)
          if (!credentials.matricula || credentials.matricula.trim() === '') {
            throw new Error('La matrícula es obligatoria')
          }
          
          if (user.matricula !== credentials.matricula) {
            console.log(`Matrícula incorrecta: esperada ${user.matricula}, recibida ${credentials.matricula}`)
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
