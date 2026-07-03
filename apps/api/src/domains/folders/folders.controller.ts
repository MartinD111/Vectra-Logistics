import { Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { foldersService } from './folders.service';

const companyOf = (req: AuthRequest): string => {
  const companyId = req.user?.company_id;
  if (!companyId) throw new AppError(403, 'No company associated');
  return companyId;
};

export const listFolders = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ folders: await foldersService.listFolderTree(companyOf(req)) });
});

export const getFolder = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ folder: await foldersService.getFolder(req.params.id, companyOf(req)) });
});

export const createFolder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const folder = await foldersService.createFolder(companyOf(req), req.user?.id ?? null, req.body);
  res.status(201).json({ folder });
});

export const updateFolder = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ folder: await foldersService.updateFolder(req.params.id, companyOf(req), req.body) });
});

export const moveFolder = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ folder: await foldersService.moveFolder(req.params.id, companyOf(req), req.body) });
});

export const deleteFolder = asyncHandler(async (req: AuthRequest, res: Response) => {
  await foldersService.deleteFolder(req.params.id, companyOf(req));
  res.status(204).send();
});
