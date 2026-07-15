import { Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import {
  type RequestContext,
  type RequestWithContext,
  requireRequestContext,
} from '../auth/request-context';

export type CapabilityName =
  | 'workspace.admin'
  | 'page.edit'
  | 'record.read'
  | 'record.write'
  | 'program.build'
  | 'program.run'
  | 'workflow.build'
  | 'workflow.run'
  | 'integration.admin'
  | 'module.access';

export interface CapabilityResult {
  allowed: boolean;
  reason: 'authenticated' | 'admin' | 'missing-company' | 'missing-user';
  capability: CapabilityName;
  metadata?: Record<string, unknown>;
}

export interface CapabilityMode {
  allowed: boolean;
  reason: 'available' | 'unavailable';
  explicitFallback:
    | null
    | {
      kind: 'demo';
      label: string;
    };
}

function hasAuthenticatedCompany(ctx: RequestContext): boolean {
  return !!ctx.user && !!ctx.companyId;
}

function isWorkspaceAdmin(ctx: RequestContext): boolean {
  return ctx.roles.includes('admin');
}

class CapabilityService {
  can(ctx: RequestContext, capability: CapabilityName, metadata: Record<string, unknown> = {}): CapabilityResult {
    if (!ctx.user) {
      return { allowed: false, reason: 'missing-user', capability, metadata };
    }
    if (!ctx.companyId) {
      return { allowed: false, reason: 'missing-company', capability, metadata };
    }

    switch (capability) {
      case 'workspace.admin':
      case 'integration.admin':
        return {
          allowed: isWorkspaceAdmin(ctx),
          reason: isWorkspaceAdmin(ctx) ? 'admin' : 'admin',
          capability,
          metadata,
        };
      case 'page.edit':
      case 'record.read':
      case 'record.write':
      case 'program.build':
      case 'program.run':
      case 'workflow.build':
      case 'workflow.run':
      case 'module.access':
        return {
          allowed: hasAuthenticatedCompany(ctx),
          reason: 'authenticated',
          capability,
          metadata,
        };
      default:
        return {
          allowed: false,
          reason: 'missing-user',
          capability,
          metadata,
        };
    }
  }

  canWorkspaceAdmin(ctx: RequestContext): CapabilityResult {
    return this.can(ctx, 'workspace.admin');
  }

  canEditPage(ctx: RequestContext, metadata: Record<string, unknown> = {}): CapabilityResult {
    return this.can(ctx, 'page.edit', metadata);
  }

  canReadRecord(ctx: RequestContext, metadata: Record<string, unknown> = {}): CapabilityResult {
    return this.can(ctx, 'record.read', metadata);
  }

  canWriteRecord(ctx: RequestContext, metadata: Record<string, unknown> = {}): CapabilityResult {
    return this.can(ctx, 'record.write', metadata);
  }

  canBuildProgram(ctx: RequestContext, metadata: Record<string, unknown> = {}): CapabilityResult {
    return this.can(ctx, 'program.build', metadata);
  }

  canRunWorkflow(ctx: RequestContext, metadata: Record<string, unknown> = {}): CapabilityResult {
    return this.can(ctx, 'workflow.run', metadata);
  }

  canBuildWorkflow(ctx: RequestContext, metadata: Record<string, unknown> = {}): CapabilityResult {
    return this.can(ctx, 'workflow.build', metadata);
  }

  canAdminIntegration(ctx: RequestContext, metadata: Record<string, unknown> = {}): CapabilityResult {
    return this.can(ctx, 'integration.admin', metadata);
  }

  canAccessModule(ctx: RequestContext, moduleKey: string): CapabilityResult {
    return this.can(ctx, 'module.access', { moduleKey });
  }

  resolveCapabilityMode(
    ctx: RequestContext,
    capabilityKey: string,
    options: { available: boolean; explicitFallbackLabel?: string | null },
  ): CapabilityMode {
    if (options.available) {
      return { allowed: true, reason: 'available', explicitFallback: null };
    }

    if (ctx.deploymentCapabilities.allowsExplicitFallbacks && options.explicitFallbackLabel) {
      return {
        allowed: true,
        reason: 'available',
        explicitFallback: { kind: 'demo', label: options.explicitFallbackLabel },
      };
    }

    return { allowed: false, reason: 'unavailable', explicitFallback: null };
  }
}

export const capabilityService = new CapabilityService();

export function assertCapability(
  ctx: RequestContext,
  capability: CapabilityName,
  metadata: Record<string, unknown> = {},
): void {
  const result = capabilityService.can(ctx, capability, metadata);
  if (!result.allowed) {
    throw new AppError(403, `Forbidden: missing capability ${capability}`);
  }
}

export function requireCapability(
  capability: CapabilityName,
  metadata: Record<string, unknown> = {},
) {
  return (req: RequestWithContext, _res: Response, next: NextFunction) => {
    try {
      const ctx = requireRequestContext(req);
      assertCapability(ctx, capability, metadata);
      next();
    } catch (error) {
      next(error);
    }
  };
}
