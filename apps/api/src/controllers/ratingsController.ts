import { Response } from 'express';
import { db } from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';

// POST /api/ratings
export const submitRating = async (req: AuthRequest, res: Response) => {
  try {
    const reviewerId = req.user?.id;
    if (!reviewerId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      booking_id,
      reviewee_id,   // user being rated
      score,         // 1–5 overall (required — column exists)
      comment,
      // Extended carrier criteria (when shipper rates carrier).
      // NOTE: These columns (delivery_punctuality, cargo_condition, communication,
      //       payment_speed, loading_conditions, shipment_accuracy) may not yet
      //       exist in the ratings table.  We attempt the full INSERT first and
      //       fall back to the core-columns-only INSERT when a DB error indicates
      //       the column is missing (code '42703' = undefined_column in Postgres).
      delivery_punctuality,
      cargo_condition,
      communication,
      // Extended shipper criteria (when carrier rates shipper)
      payment_speed,
      loading_conditions,
      shipment_accuracy,
    } = req.body;

    if (!booking_id || !reviewee_id || !score) {
      return res.status(400).json({ error: 'booking_id, reviewee_id, and score are required' });
    }

    if (score < 1 || score > 5) {
      return res.status(400).json({ error: 'score must be between 1 and 5' });
    }

    // Prevent duplicate ratings for the same booking by the same reviewer
    const existing = await db.query(
      `SELECT id FROM ratings WHERE booking_id = $1 AND reviewer_id = $2`,
      [booking_id, reviewerId],
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'You have already rated this booking' });
    }

    // --- Attempt full INSERT (with extended criteria columns) ---
    try {
      const result = await db.query(
        `INSERT INTO ratings (
           booking_id, reviewer_id, reviewee_id, score, comment,
           delivery_punctuality, cargo_condition, communication,
           payment_speed, loading_conditions, shipment_accuracy
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          booking_id, reviewerId, reviewee_id, score, comment || null,
          delivery_punctuality   || null,
          cargo_condition        || null,
          communication          || null,
          payment_speed          || null,
          loading_conditions     || null,
          shipment_accuracy      || null,
        ],
      );

      return res.status(201).json(result.rows[0]);
    } catch (extendedErr: any) {
      // 42703 = undefined_column — extended schema not yet migrated
      if (extendedErr?.code !== '42703') throw extendedErr;

      // --- Fallback: core columns only ---
      console.warn(
        '[submitRating] Extended criteria columns not found in ratings table. ' +
        'Falling back to core-column INSERT. Run the ratings schema migration to unlock full functionality.',
      );

      const fallbackResult = await db.query(
        `INSERT INTO ratings (booking_id, reviewer_id, reviewee_id, score, comment)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [booking_id, reviewerId, reviewee_id, score, comment || null],
      );

      return res.status(201).json({
        ...fallbackResult.rows[0],
        _note: 'Extended rating criteria were ignored — pending schema migration.',
      });
    }
  } catch (error) {
    console.error('submitRating error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/ratings/company/:companyId
export const getCompanyRatings = async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.params;
    const page   = parseInt(req.query.page  as string) || 1;
    const limit  = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT r.*,
              u.first_name AS reviewer_first_name,
              u.last_name  AS reviewer_last_name,
              u.role       AS reviewer_role
       FROM ratings r
       JOIN users u  ON r.reviewer_id = u.id
       JOIN users rv ON r.reviewee_id = rv.id
       WHERE rv.company_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [companyId, limit, offset],
    );

    res.status(200).json({ ratings: result.rows, page, limit });
  } catch (error) {
    console.error('getCompanyRatings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/ratings/company/:companyId/summary
export const getCompanyRatingSummary = async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.params;

    // --- Attempt summary query with extended columns ---
    let summaryRow: Record<string, unknown>;
    try {
      const summaryResult = await db.query(
        `SELECT
           COUNT(*)                                              AS total_reviews,
           ROUND(AVG(r.score)::numeric,                    2)   AS avg_score,
           ROUND(AVG(r.delivery_punctuality)::numeric,     2)   AS avg_delivery_punctuality,
           ROUND(AVG(r.cargo_condition)::numeric,          2)   AS avg_cargo_condition,
           ROUND(AVG(r.communication)::numeric,            2)   AS avg_communication,
           ROUND(AVG(r.payment_speed)::numeric,            2)   AS avg_payment_speed,
           ROUND(AVG(r.loading_conditions)::numeric,       2)   AS avg_loading_conditions,
           ROUND(AVG(r.shipment_accuracy)::numeric,        2)   AS avg_shipment_accuracy
         FROM ratings r
         JOIN users rv ON r.reviewee_id = rv.id
         WHERE rv.company_id = $1`,
        [companyId],
      );
      summaryRow = summaryResult.rows[0];
    } catch (extendedErr: any) {
      // 42703 = undefined_column — fall back to core columns only
      if (extendedErr?.code !== '42703') throw extendedErr;

      console.warn(
        '[getCompanyRatingSummary] Extended criteria columns not found — ' +
        'returning core summary only.',
      );

      const coreSummary = await db.query(
        `SELECT
           COUNT(*)                                   AS total_reviews,
           ROUND(AVG(r.score)::numeric, 2)            AS avg_score
         FROM ratings r
         JOIN users rv ON r.reviewee_id = rv.id
         WHERE rv.company_id = $1`,
        [companyId],
      );
      summaryRow = {
        ...coreSummary.rows[0],
        _note: 'Extended criteria averages unavailable — pending schema migration.',
      };
    }

    // Booking completion stats (carrier perspective)
    const bookingStats = await db.query(
      `SELECT
         COUNT(*)                                                              AS total_bookings,
         COUNT(CASE WHEN status = 'completed' THEN 1 END)                     AS completed_bookings,
         ROUND(
           COUNT(CASE WHEN status = 'completed' THEN 1 END)::decimal
             / NULLIF(COUNT(*), 0) * 100,
           1
         )                                                                     AS success_rate
       FROM bookings
       WHERE carrier_company_id = $1 OR shipper_company_id = $1`,
      [companyId],
    );

    res.status(200).json({
      ...summaryRow,
      ...bookingStats.rows[0],
    });
  } catch (error) {
    console.error('getCompanyRatingSummary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
