// @vectra/api-client — typed fetch client for the Vectra API, shared across apps.
//
// The token is read from @vectra/auth's shared session, so all three apps
// authenticate identically. Domain-specific API modules (marketplace, fleet,
// etc.) still live in their owning app and call apiFetch from here.

export { apiFetch, ApiError } from './client';
