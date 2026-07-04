import { Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { ltlService } from './ltl.service';

const requireCompany = (req: AuthRequest): string => {
  const companyId = req.user?.company_id;
  if (!companyId) throw new AppError(403, 'No company associated');
  return companyId;
};

export const listSuggestions = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ suggestions: await ltlService.listSuggestions(requireCompany(req)) });
});

export const listPartials = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ partials: await ltlService.listPartials(requireCompany(req)) });
});

export const createPartial = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(201).json({ partial: await ltlService.createPartial(requireCompany(req), req.body) });
});

export const scan = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ suggestions: await ltlService.scan(requireCompany(req)) });
});

export const acceptSuggestion = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ suggestion: await ltlService.accept(req.params.id, requireCompany(req), req.user?.id ?? null) });
});

export const dismissSuggestion = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ suggestion: await ltlService.dismiss(req.params.id, requireCompany(req)) });
});
