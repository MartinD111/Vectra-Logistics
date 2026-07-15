import { randomUUID } from 'crypto';
import { Request } from 'express';
import { getDeploymentMode, type DeploymentMode } from '../config/secrets';
import { AppError } from '../errors/AppError';

export interface RequestUser {
  id: string;
  role: string;
  company_id: string | null;
  is_verified: boolean;
}

export interface DeploymentCapabilities {
  mode: DeploymentMode;
  allowsLocalAiProxy: boolean;
  allowsSelfSignup: boolean;
  allowsExplicitFallbacks: boolean;
  requiresTrustedPublicEdges: boolean;
}

export interface RequestContext {
  user: RequestUser | null;
  companyId: string | null;
  roles: string[];
  workspaceId: string | null;
  requestId: string;
  deploymentMode: DeploymentMode;
  deploymentCapabilities: DeploymentCapabilities;
}

export interface RequestWithContext extends Request {
  user?: RequestUser;
  context?: RequestContext;
}

export function buildDeploymentCapabilities(mode: DeploymentMode): DeploymentCapabilities {
  return {
    mode,
    allowsLocalAiProxy: mode === 'on-prem',
    allowsSelfSignup: mode === 'cloud',
    allowsExplicitFallbacks: true,
    requiresTrustedPublicEdges: true,
  };
}

export function buildRequestContext(user: RequestUser | null, requestId: string): RequestContext {
  const deploymentMode = getDeploymentMode();
  return {
    user,
    companyId: user?.company_id ?? null,
    roles: user?.role ? [user.role] : [],
    workspaceId: user?.company_id ?? null,
    requestId,
    deploymentMode,
    deploymentCapabilities: buildDeploymentCapabilities(deploymentMode),
  };
}

export function buildServiceRequestContext(companyId: string | null, requestId = 'system'): RequestContext {
  const ctx = buildRequestContext(null, requestId);
  return {
    ...ctx,
    companyId,
    workspaceId: companyId,
  };
}

export function resolveRequestId(req: Request): string {
  const header = req.headers['x-request-id'];
  if (typeof header === 'string' && header.trim().length > 0) {
    return header.trim();
  }
  if (Array.isArray(header) && header[0]?.trim()) {
    return header[0].trim();
  }
  return randomUUID();
}

export function getRequestContext(req: RequestWithContext): RequestContext | null {
  return req.context ?? null;
}

export function requireRequestContext(req: RequestWithContext): RequestContext {
  const ctx = getRequestContext(req);
  if (!ctx) {
    throw new AppError(401, 'Unauthorized');
  }
  return ctx;
}

export function requireCompanyId(source: RequestWithContext | RequestContext): string {
  const companyId = 'headers' in source ? requireRequestContext(source).companyId : source.companyId;
  if (!companyId) {
    throw new AppError(403, 'No company associated');
  }
  return companyId;
}

export function requireUserId(source: RequestWithContext | RequestContext): string {
  const userId = 'headers' in source ? requireRequestContext(source).user?.id ?? null : source.user?.id ?? null;
  if (!userId) {
    throw new AppError(401, 'Unauthorized');
  }
  return userId;
}
