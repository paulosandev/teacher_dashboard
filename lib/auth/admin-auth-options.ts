import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

export const adminAuthOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'admin-credentials',
      credentials: {
        username: {
          label: "Admin Username",
          type: "text"
        },
        password: {
          label: "Admin Password",
          type: "password"
        }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        // Simple admin authentication check
        const adminUsername = process.env.ADMIN_USERNAME || 'admin'
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'

        if (credentials.username === adminUsername && credentials.password === adminPassword) {
          return {
            id: 'admin',
            username: credentials.username,
            role: 'admin'
          }
        }

        return null
      }
    })
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.username = user.username
        token.role = user.role
      }
      return token
    },

    async session({ session, token }) {
      if (token) {
        session.user = {
          ...session.user,
          username: token.username as string,
          role: token.role as string
        }
      }
      return session
    }
  },

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },

  debug: false,
}