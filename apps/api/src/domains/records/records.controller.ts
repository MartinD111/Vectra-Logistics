import { Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { requireCompanyId, requireRequestContext } from '../../core/auth/request-context';
import { recordsService } from './records.service';

// ── Collections ──
export const listCollections = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ collections: await recordsService.listCollections(requireCompanyId(req)) });
});

export const getCollection = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ collection: await recordsService.getCollection(req.params.id, requireCompanyId(req)) });
});

export const createCollection = asyncHandler(async (req: AuthRequest, res: Response) => {
  // recordsService.createCollection returns { collection, view } (D-03: default
  // view is auto-created atomically) — surface both in the response body.
  const { collection, view } = await recordsService.createCollection(
    requireCompanyId(req),
    req.body,
    requireRequestContext(req),
  );
  res.status(201).json({ collection, view });
});

export const updateCollection = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ collection: await recordsService.updateCollection(req.params.id, requireCompanyId(req), req.body) });
});

// ── Records ──
export const listRecords = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ records: await recordsService.listRecords(req.params.id, requireCompanyId(req)) });
});

export const createRecord = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(201).json({ record: await recordsService.createRecord(requireCompanyId(req), req.body) });
});

export const getRecord = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ record: await recordsService.getRecord(req.params.id, requireCompanyId(req)) });
});

export const updateRecord = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ record: await recordsService.updateRecord(req.params.id, requireCompanyId(req), req.body) });
});

export const listRecordChildren = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ children: await recordsService.listRecordChildren(req.params.id, requireCompanyId(req)) });
});

// ── Views ──
export const listViews = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ views: await recordsService.listViews(req.params.id, requireCompanyId(req)) });
});

export const createView = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(201).json({ view: await recordsService.createView(requireCompanyId(req), req.params.id, req.body) });
});

export const getView = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ view: await recordsService.getView(req.params.id, requireCompanyId(req)) });
});

export const updateView = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ view: await recordsService.updateView(req.params.id, requireCompanyId(req), req.body) });
});
