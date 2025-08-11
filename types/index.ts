// Tipos para el análisis académico
export interface AnalysisStrength {
  id: string
  description: string
  evidence?: string
}

export interface AnalysisAlert {
  id: string
  description: string
  severity: 'low' | 'medium' | 'high'
  studentIds?: string[]
}

export interface AnalysisNextStep {
  action: string
  priority: 'low' | 'medium' | 'high'
  rationale?: string
}

export interface AnalysisCardData {
  id: string
  title: string
  type: 'activity' | 'forum'
  courseId: string
  groupId?: string
  strengths: AnalysisStrength[]
  alerts: AnalysisAlert[]
  nextStep: AnalysisNextStep
  lastUpdated: Date
  confidence?: number
}

// Tipos para Moodle
export interface MoodleCourse {
  id: string
  fullname: string
  shortname: string
  enrolledusercount?: number
}

export interface MoodleGroup {
  id: string
  name: string
  courseid: string
}

export interface MoodleActivity {
  id: string
  name: string
  modname: string // tipo de actividad
  visible: boolean
  uservisible: boolean
  duedate?: number // timestamp
}

export interface MoodleForum {
  id: string
  name: string
  intro: string
  type: string
}

export interface MoodleForumPost {
  id: string
  subject: string
  message: string
  userid: string
  created: number
  modified: number
}

// Tipos para autenticación
export interface UserSession {
  id: string
  email: string
  username: string
  matricula: string
  name?: string
}
