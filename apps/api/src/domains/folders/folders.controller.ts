import { Response } from 'express';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { requireRequestContext, RequestWithContext } from '../../core/auth/request-context';
import { foldersService } from './folders.service';

export const listFolders = asyncHandler(async (req: RequestWithContext, res: Response) => {
  res.json({ folders: await foldersService.listFolderTree(requireRequestContext(req)) });
});

export const getFolder = asyncHandler(async (req: RequestWithContext, res: Response) => {
  res.json({ folder: await foldersService.getFolder(requireRequestContext(req), req.params.id) });
});

export const createFolder = asyncHandler(async (req: RequestWithContext, res: Response) => {
  const folder = await foldersService.createFolder(requireRequestContext(req), req.body);
  res.status(201).json({ folder });
});

export const updateFolder = asyncHandler(async (req: RequestWithContext, res: Response) => {
  res.json({ folder: await foldersService.updateFolder(requireRequestContext(req), req.params.id, req.body) });
});

export const moveFolder = asyncHandler(async (req: RequestWithContext, res: Response) => {
  res.json({ folder: await foldersService.moveFolder(requireRequestContext(req), req.params.id, req.body) });
});

export const archiveFolder = asyncHandler(async (req: RequestWithContext, res: Response) => {
  res.json({ folder: await foldersService.archiveFolder(requireRequestContext(req), req.params.id) });
});

export const unarchiveFolder = asyncHandler(async (req: RequestWithContext, res: Response) => {
  res.json({ folder: await foldersService.unarchiveFolder(requireRequestContext(req), req.params.id) });
});
