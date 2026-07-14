import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import {
  listCollections, getCollection, createCollection, updateCollection,
  listRecords, createRecord, getRecord, updateRecord, listRecordChildren,
  listViews, createView, getView, updateView,
} from './records.controller';

const router = Router();
router.use(authenticateToken);

router.get('/collections', listCollections);
router.post('/collections', createCollection);
router.get('/collections/:id', getCollection);
router.patch('/collections/:id', updateCollection);

router.get('/collections/:id/records', listRecords);
router.post('/collections/:id/records', createRecord);

router.get('/collections/:id/views', listViews);
router.post('/collections/:id/views', createView);

router.get('/records/:id', getRecord);
router.patch('/records/:id', updateRecord);
router.get('/records/:id/children', listRecordChildren);

router.get('/views/:id', getView);
router.patch('/views/:id', updateView);

export default router;
