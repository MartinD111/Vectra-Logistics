import { Response } from 'express';
import { db } from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';

// Get all documents for user's company, with filters
export const getDocuments = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    const userId = req.user?.id;
    const { from, to, license_plate, driver_name, doc_type } = req.query;

    let query = `
      SELECT d.*, b.id as booking_id, v.license_plate, 
             dr.first_name || ' ' || dr.last_name as driver_name
      FROM documents d
      LEFT JOIN bookings b ON d.booking_id = b.id
      LEFT JOIN capacity_listings cl ON b.capacity_listing_id = cl.id
      LEFT JOIN vehicles v ON cl.vehicle_id = v.id
      LEFT JOIN drivers dr ON cl.user_id = dr.company_id
      WHERE d.created_by = $1
    `;
    const params: any[] = [userId];
    let idx = 2;

    if (from) { query += ` AND d.created_at >= $${idx++}`; params.push(from); }
    if (to) { query += ` AND d.created_at <= $${idx++}`; params.push(to); }
    if (license_plate) { query += ` AND v.license_plate ILIKE $${idx++}`; params.push(`%${license_plate}%`); }
    if (doc_type) { query += ` AND d.document_type = $${idx++}`; params.push(doc_type); }

    query += ` ORDER BY d.created_at DESC`;

    const result = await db.query(query, params);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Upload a company document (PDF or image for registration/verification)
export const uploadCompanyDocument = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    const userId = req.user?.id;
    if (!companyId) return res.status(403).json({ error: 'No company associated' });

    const { document_type } = req.body;
    const file = (req as any).file;

    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const fileUrl = `/uploads/${file.filename}`;

    const result = await db.query(
      `INSERT INTO company_documents (company_id, document_type, file_url, uploaded_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [companyId, document_type || 'registration', fileUrl, userId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get company verification documents
export const getCompanyDocuments = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(403).json({ error: 'No company associated' });

    const result = await db.query(
      `SELECT * FROM company_documents WHERE company_id = $1 ORDER BY created_at DESC`,
      [companyId]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Get company documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
