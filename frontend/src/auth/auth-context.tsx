/**
 * Session state for the whole application.
 *
 * The token lives in localStorage so a refresh does not throw the dispatcher
 * out mid-incident. On boot the stored token is validated against `/auth/me`
 * rather than trusted, because it may have expired while the tab was closed.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"

import { tokenStorage, UNAUTHORIZED_EVENT } from "@/api/client"
import { auth } from "@/api/endpoints"
import type { User, UserRole } from "@/api/types"

interface AuthState {
  user: User | null
  /** True until the stored token has been checked, so guards do not flash. */
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  /** Role check used to hide actions the backend would answer with a 403. */
  can: (roles: UserRole[]) => boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    async function restore() {
      if (!tokenStorage.get()) {
        setLoading(false)
        return
      }

      try {
        setUser(await auth.me(controller.signal))
      } catch (cause: unknown) {
        // An abort is not a rejected token: React runs this effect twice in
        // StrictMode and the first cleanup cancels its own request. Treating
        // that as a failure would drop a perfectly good token and log the user
        // out on every page refresh.
        // Returning here also leaves `loading` set: the second attempt is
        // still in flight, and releasing the guard early would bounce the user
        // to the login screen and lose the address they refreshed on.
        if (cause instanceof DOMException && cause.name === "AbortError") return

        // An expired or tampered token is simply dropped; the guard sends the
        // user to the login screen.
        tokenStorage.clear()
        setUser(null)
      }

      setLoading(false)
    }

    void restore()
    return () => controller.abort()
  }, [])

  // Any request that comes back 401 ends the session, wherever it was fired.
  useEffect(() => {
    const onUnauthorized = () => setUser(null)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { token } = await auth.login(email, password)
    tokenStorage.set(token)

    // The login answer carries the JWT payload (`sub`, e-mail, role), not a
    // user record. Reading `/auth/me` right after keeps a single shape in the
    // interface instead of two objects that only look alike.
    setUser(await auth.me())
  }, [])

  const logout = useCallback(() => {
    // The cookie is cleared server-side as a courtesy; the local token going
    // away is what actually ends the session here.
    void auth.logout().catch(() => undefined)
    tokenStorage.clear()
    setUser(null)
  }, [])

  const can = useCallback(
    (roles: UserRole[]) => (user ? roles.includes(user.role) : false),
    [user],
  )

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, logout, can }),
    [user, loading, login, logout, can],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth precisa estar dentro de <AuthProvider>")
  return context
}
