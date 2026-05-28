import { Request, Response } from 'express';
import { db } from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';

// GET /api/companies/:id/business-card (public)
export const getCompanyBusinessCard = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const companyResult = await db.query(
      `SELECT c.id, c.name, c.country, c.city, c.status,
              c.created_at,
              COUNT(DISTINCT v.id) AS vehicle_count
       FROM companies c
       LEFT JOIN vehicles v ON v.company_id = c.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [id]
    );

    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const company = companyResult.rows[0];

    // Get rating summary
    const ratingsResult = await db.query(
      `SELECT
        COUNT(*) AS total_reviews,
        ROUND(AVG(r.score)::numeric, 2) AS avg_score
       FROM ratings r
       JOIN users rv ON r.reviewee_id = rv.id
       WHERE rv.company_id = $1`,
      [id]
    );

    // Get booking stats (carrier perspective)
    const bookingResult = await db.query(
      `SELECT
        COUNT(*) AS total_bookings,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed,
        ROUND(
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::decimal
          / NULLIF(COUNT(*), 0) * 100,
          1
        ) AS success_rate
       FROM bookings
       WHERE carrier_company_id = $1`,
      [id]
    );

    const yearsActive = Math.floor(
      (Date.now() - new Date(company.created_at).getTime()) /
        (1000 * 60 * 60 * 24 * 365)
    );

    res.status(200).json({
      id: company.id,
      name: company.name,
      country: company.country,
      city: company.city,
      isVerified: company.status === 'approved',
      fleetSize: parseInt(company.vehicle_count, 10) || 0,
      yearsActive,
      memberSince: new Date(company.created_at).getFullYear(),
      ratings: ratingsResult.rows[0],
      bookingStats: bookingResult.rows[0],
    });
  } catch (error) {
    console.error('getCompanyBusinessCard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/companies/:id/verify  (auth required — own company or admin)
export const getVerificationStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const requestingCompanyId = req.user?.company_id;

    if (id !== requestingCompanyId && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await db.query(
      `SELECT
        c.status,
        c.vat_number,
        c.registration_number,
        json_agg(
          json_build_object(
            'type',        cd.document_type,
            'status',      cd.status,
            'uploaded_at', cd.created_at
          )
        ) FILTER (WHERE cd.id IS NOT NULL) AS documents
       FROM companies c
       LEFT JOIN company_documents cd ON cd.company_id = c.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Normalise: return empty array when the company has no documents yet
    const row = result.rows[0];
    if (row.documents === null) {
      row.documents = [];
    }

    res.status(200).json(row);
  } catch (error) {
    console.error('getVerificationStatus error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/companies/verification/submit  (auth required)
export const submitVerification = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ error: 'No company associated with this account' });
    }

    const { document_type, file_url } = req.body;

    if (!document_type || !file_url) {
      return res
        .status(400)
        .json({ error: 'document_type and file_url are required' });
    }

    const result = await db.query(
      `INSERT INTO company_documents (company_id, document_type, file_url, uploaded_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [companyId, document_type, file_url, req.user?.id]
    );

    // Move the company into pending-review so the admin queue picks it up
    await db.query(
      `UPDATE companies
       SET status = 'pending', updated_at = NOW()
       WHERE id = $1`,
      [companyId]
    );

    res.status(201).json({
      document: result.rows[0],
      message: 'Verification document submitted successfully. It is now under review.',
    });
  } catch (error) {
    console.error('submitVerification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
