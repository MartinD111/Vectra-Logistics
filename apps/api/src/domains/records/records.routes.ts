import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import { requireCapability } from '../../core/capabilities';
import {
  listCollections, getCollection, createCollection, updateCollection,
  listRecords, createRecord, getRecord, updateRecord, listRecordChildren,
  listViews, createView, getView, updateView,
} from './records.controller';

const router = Router();
router.use(authenticateToken);

router.get('/collections', listCollections);
router.post('/collections', requireCapability('record.write'), createCollection);
router.get('/collections/:id', getCollection);
router.patch('/collections/:id', requireCapability('record.write'), updateCollection);

router.get('/collections/:id/records', requireCapability('record.read'), listRecords);
router.post('/collections/:id/records', requireCapability('record.write'), createRecord);

router.get('/collections/:id/views', listViews);
router.post('/collections/:id/views', requireCapability('record.write'), createView);

router.get('/records/:id', requireCapability('record.read'), getRecord);
router.patch('/records/:id', requireCapability('record.write'), updateRecord);
router.get('/records/:id/children', requireCapability('record.read'), listRecordChildren);

router.get('/views/:id', requireCapability('record.read'), getView);
router.patch('/views/:id', requireCapability('record.write'), updateView);

export default router;
