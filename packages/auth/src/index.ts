// @vectra/auth — shared authentication for all three Vectra apps.
//
// Provides AuthProvider/useAuth backed by a cookie-based session (shared across
// apps on the same host for SSO), server-side session validation via /auth/me,
// and route guards.

export { AuthProvider, useAuth } from './AuthContext';
export type { AuthProviderProps } from './AuthContext';
export { RequireAuth, RequireRole, RequireWorkspace } from './guards';
export type {
  RequireAuthProps,
  RequireRoleProps,
  RequireWorkspaceProps,
} from './guards';
export {
  getToken,
  getStoredUser,
  setSession,
  clearSession,
} from './session';
