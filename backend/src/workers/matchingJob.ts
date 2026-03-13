import axios from 'axios';
import { db } from '../config/db';

/**
 * Scheduled worker that runs every 5 minutes.
 * Responsibilities:
 * - Scan active truck routes
 * - Scan pending shipments
 * - Query Python matching engine
 * - Trigger Socket.io alerts or Emails (stubs)
 */
export const startMatchingWorker = () => {
  const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  setInterval(async () => {
    console.log('[Worker] Running scheduled Smart Freight Alerts job...');
    try {
      // 1. Fetch pending shipments & available capacities
      // 2. Send batch to Python engine
      // const response = await axios.post(`${process.env.MATCHING_ENGINE_URL}/batch-match`, { ... });
      
      // 3. Process returned scores (>75, detour <15%)
      // 4. Save to `matches` table
      // 5. Emit WebSocket events to active users
      console.log('[Worker] Match evaluation completed.');
    } catch (err) {
      console.error('[Worker] Error during matching job:', err);
    }
  }, INTERVAL_MS);
};
