import { create } from 'zustand'
import { apiClient, setAuthToken } from '@/lib/api-client'

const STORAGE_KEY = 'wallet-admin-auth'

type AuthUser = {
  id: string
  email: string
  name?: string | null
  walletId: string
}

type AuthResponse = {
  accessToken: string
  user: AuthUser
}

type Credentials = {
  email: string
  password: string
}

type RegisterPayload = {
  email: string
  password: string
  name?: string
}

type AuthState = {
  token: string | null
  user: AuthUser | null
  loading: boolean
  error: string | null
  hydrated: boolean
  login: (credentials: Credentials) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => void
  clearError: () => void
  bootstrap: () => void
}

const readStoredSession = (): AuthResponse | null => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuthResponse) : null
  } catch {
    return null
  }
}

const persistSession = (session: AuthResponse | null) => {
  if (typeof window === 'undefined') {
    return
  }
  try {
    if (session) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // ignore persistence errors
  }
}

const initialSession = readStoredSession()
if (initialSession?.accessToken) {
  setAuthToken(initialSession.accessToken)
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: initialSession?.accessToken ?? null,
  user: initialSession?.user ?? null,
  loading: false,
  error: null,
  hydrated: typeof window === 'undefined',
  async login(credentials) {
    set({ loading: true, error: null })
    try {
      const { data } = await apiClient.post<AuthResponse>('/auth/login', credentials)
      setAuthToken(data.accessToken)
      persistSession(data)
      set({ token: data.accessToken, user: data.user, loading: false })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to login. Please try again.'
      set({ error: message, loading: false })
      throw error
    }
  },
  async register(payload) {
    set({ loading: true, error: null })
    try {
      const { data } = await apiClient.post<AuthResponse>('/auth/register', payload)
      setAuthToken(data.accessToken)
      persistSession(data)
      set({ token: data.accessToken, user: data.user, loading: false })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to register. Please try again.'
      set({ error: message, loading: false })
      throw error
    }
  },
  logout() {
    persistSession(null)
    setAuthToken(null)
    set({ token: null, user: null })
  },
  clearError() {
    if (get().error) {
      set({ error: null })
    }
  },
  bootstrap() {
    if (get().hydrated) {
      return
    }
    const storedSession = readStoredSession()
    if (storedSession?.accessToken) {
      setAuthToken(storedSession.accessToken)
      set({
        token: storedSession.accessToken,
        user: storedSession.user,
        hydrated: true,
      })
    } else {
      setAuthToken(null)
      set({ hydrated: true, token: null, user: null })
    }
  },
}))
