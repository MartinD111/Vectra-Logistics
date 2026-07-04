import { Request, Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { outlookService } from './outlook.service';

const companyOf = (req: AuthRequest): string => {
  const companyId = req.user?.company_id;
  if (!companyId) throw new AppError(403, 'No company associated');
  return companyId;
};

// Where to send the browser after the OAuth round-trip completes.
const APP_URL = process.env.WORKSPACES_APP_URL || 'http://localhost:3001';

export const getStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ status: await outlookService.getStatus(companyOf(req)) });
});

export const connect = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await outlookService.beginConnect(
    companyOf(req), req.user?.id ?? null, (req.body?.email as string) ?? null,
  );
  res.json(result);
});

export const disconnect = asyncHandler(async (req: AuthRequest, res: Response) => {
  await outlookService.disconnect(companyOf(req), req.user?.id ?? null);
  res.status(204).send();
});

export const syncCalendar = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(await outlookService.syncCalendar(companyOf(req), req.user?.id ?? null));
});

// Unauthenticated — Microsoft redirects here. Validated via the signed `state`.
export const callback = asyncHandler(async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  if (!code || !state) {
    return res.redirect(`${APP_URL}/integrations?error=outlook`);
  }
  try {
    await outlookService.handleCallback(code, state);
    res.redirect(`${APP_URL}/integrations?connected=outlook`);
  } catch {
    res.redirect(`${APP_URL}/integrations?error=outlook`);
  }
});
