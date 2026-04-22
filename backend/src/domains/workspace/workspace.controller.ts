import { Request, Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { workspaceService } from './workspace.service';

const requireUser = (req: AuthRequest): string => {
  const userId = req.user?.id;
  if (!userId) throw new AppError(401, 'Unauthorized');
  return userId;
};

const requireCompany = (req: AuthRequest): string => {
  const companyId = req.user?.company_id;
  if (!companyId) throw new AppError(403, 'No company associated');
  return companyId;
};

// ── Company ───────────────────────────────────────────────────────────────

export const getCompanyBusinessCard = asyncHandler(async (req: Request, res: Response) => {
  const card = await workspaceService.getCompanyBusinessCard(req.params.id);
  res.status(200).json(card);
});

export const getVerificationStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const status = await workspaceService.getVerificationStatus(
    req.params.id,
    req.user?.company_id ?? null,
    req.user?.role ?? '',
  );
  res.status(200).json(status);
});

export const submitVerification = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  const userId = requireUser(req);
  const result = await workspaceService.submitVerification(companyId, userId, req.body);
  res.status(201).json(result);
});

// ── Ratings ───────────────────────────────────────────────────────────────

export const submitRating = asyncHandler(async (req: AuthRequest, res: Response) => {
  const reviewerId = requireUser(req);
  const rating = await workspaceService.submitRating(reviewerId, req.body);
  res.status(201).json(rating);
});

export const getCompanyRatings = asyncHandler(async (req: Request, res: Response) => {
  const page  = parseInt(req.query.page  as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const result = await workspaceService.getCompanyRatings(req.params.companyId, page, limit);
  res.status(200).json(result);
});

export const getCompanyRatingSummary = asyncHandler(async (req: Request, res: Response) => {
  const summary = await workspaceService.getCompanyRatingSummary(req.params.companyId);
  res.status(200).json(summary);
});

// ── Documents ─────────────────────────────────────────────────────────────

export const getDocuments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = requireUser(req);
  const docs = await workspaceService.getDocuments(userId, req.query);
  res.status(200).json(docs);
});

export const uploadCompanyDocument = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  const userId = requireUser(req);
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) throw new AppError(400, 'No file uploaded');
  const fileUrl = `/uploads/${file.filename}`;
  const documentType = (req.body.document_type as string | undefined) ?? 'registration';
  const doc = await workspaceService.uploadCompanyDocument(companyId, userId, documentType, fileUrl);
  res.status(201).json(doc);
});

export const getCompanyDocuments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  const docs = await workspaceService.getCompanyDocuments(companyId);
  res.status(200).json(docs);
});
