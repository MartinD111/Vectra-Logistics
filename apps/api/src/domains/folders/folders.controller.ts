import { Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { requireCompanyId, requireRequestContext } from '../../core/auth/request-context';
import { foldersService } from './folders.service';

export const listFolders = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ folders: await foldersService.listFolderTree(requireCompanyId(req)) });
});

export const getFolder = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ folder: await foldersService.getFolder(req.params.id, requireCompanyId(req)) });
});

export const createFolder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = requireRequestContext(req);
  const folder = await foldersService.createFolder(requireCompanyId(ctx), ctx.user?.id ?? null, req.body);
  res.status(201).json({ folder });
});

export const updateFolder = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ folder: await foldersService.updateFolder(req.params.id, requireCompanyId(req), req.body) });
});

export const moveFolder = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ folder: await foldersService.moveFolder(req.params.id, requireCompanyId(req), req.body) });
});

export const deleteFolder = asyncHandler(async (req: AuthRequest, res: Response) => {
  await foldersService.deleteFolder(req.params.id, requireCompanyId(req));
  res.status(204).send();
});
