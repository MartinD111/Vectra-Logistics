// Thin re-export of the shared API client. The implementation now lives in
// @vectra/api-client so all three apps share one client and one auth source.
// Existing imports (`@/lib/api/client`) keep working unchanged.
export { apiFetch, ApiError } from '@vectra/api-client';
