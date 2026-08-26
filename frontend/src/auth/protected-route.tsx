/**
 * Route guards.
 *
 * These only shape the interface. Every endpoint behind them is guarded again
 * on the backend, so hiding a screen is a convenience, never the security
 * boundary.
 */

import { Navigate, Outlet, useLocation } from "react-router-dom"

import { useAuth } from "./auth-context"
import type { UserRole } from "@/api/types"
import { FullPageSpinner } from "@/components/layout/feedback"

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner label="Verificando sessão..." />

  if (!user) {
    // `state.from` lets the login screen return the user to where they were.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export function RequireRole({ roles }: { roles: UserRole[] }) {
  const { user, loading } = useAuth()

  if (loading) return <FullPageSpinner label="Verificando permissões..." />
  if (!user) return <Navigate to="/login" replace />

  if (!roles.includes(user.role)) return <Navigate to="/" replace />

  return <Outlet />
}
