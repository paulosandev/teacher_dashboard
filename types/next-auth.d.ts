import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface User {
    id: string
    email: string
    name?: string | null
    matricula: string
    username?: string
    moodleToken?: string
    tokenExpiry?: Date
  }

  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      matricula: string
      username?: string
      moodleToken?: string
      tokenExpiry?: Date
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    email: string
    matricula: string
    username?: string
    moodleToken?: string
    tokenExpiry?: Date
  }
}
