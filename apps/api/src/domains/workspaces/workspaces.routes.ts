import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import {
  listPresets,
  getCurrentWorkspace,
  getWorkspace,
  updateBranding,
  applyPresets,
  removePreset,
} from './workspaces.controller';

const router = Router();

// All workspace routes require an authenticated user.
router.use(authenticateToken);

// Presets (the selectable workspace "types"). Registered before /:id so the
// literal "presets" segment is never matched as a workspace :id.
router.get('/presets', listPresets);

// Current company's workspace.
router.get('/current', getCurrentWorkspace);

// Single workspace + its applied presets.
router.get('/:id', getWorkspace);

// Branding (admin of the owning company).
router.patch('/:id/branding', updateBranding);

// Applied presets (multi-select types).
router.post('/:id/presets', applyPresets);
router.delete('/:id/presets/:presetId', removePreset);

export default router;
