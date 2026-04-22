import { db } from '../../core/db';
import {
  CompanyBusinessCard,
  CompanyVerificationStatus,
  CompanyDocument,
  Rating,
  RatingWithReviewer,
  RatingSummary,
  Document,
  DocumentFilters,
} from './workspace.types';
import { SubmitRatingDto } from './dto/submit-rating.dto';
import { SubmitVerificationDto } from './dto/submit-verification.dto';

class WorkspaceRepository {
  // ── Company ───────────────────────────────────────────────────────────────

  async findCompanyBusinessCard(companyId: string): Promise<CompanyBusinessCard | null> {
    const { rows: companyRows } = await db.query(
      `SELECT c.id, c.name, c.country, c.city, c.status, c.created_at,
              COUNT(DISTINCT v.id) AS vehicle_count
       FROM companies c
       LEFT JOIN vehicles v ON v.company_id = c.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [companyId],
    );
    if (companyRows.length === 0) return null;

    const company = companyRows[0];

    const { rows: ratingRows } = await db.query(
      `SELECT COUNT(*) AS total_reviews, ROUND(AVG(r.score)::numeric, 2) AS avg_score
       FROM ratings r
       JOIN users rv ON r.reviewee_id = rv.id
       WHERE rv.company_id = $1`,
      [companyId],
    );

    const { rows: bookingRows } = await db.query(
      `SELECT
         COUNT(*) AS total_bookings,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed,
         ROUND(
           COUNT(CASE WHEN status = 'completed' THEN 1 END)::decimal
           / NULLIF(COUNT(*), 0) * 100, 1
         ) AS success_rate
       FROM bookings
       WHERE carrier_company_id = $1`,
      [companyId],
    );

    const yearsActive = Math.floor(
      (Date.now() - new Date(company.created_at).getTime()) / (1000 * 60 * 60 * 24 * 365),
    );

    return {
      id: company.id,
      name: company.name,
      country: company.country,
      city: company.city,
      isVerified: company.status === 'approved',
      fleetSize: parseInt(company.vehicle_count, 10) || 0,
      yearsActive,
      memberSince: new Date(company.created_at).getFullYear(),
      ratings: ratingRows[0],
      bookingStats: bookingRows[0],
    };
  }

  async findCompanyVerificationStatus(companyId: string): Promise<CompanyVerificationStatus | null> {
    const { rows } = await db.query(
      `SELECT
         c.status, c.vat_number, c.registration_number,
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
      [companyId],
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    row.documents = row.documents ?? [];
    return row as CompanyVerificationStatus;
  }

  async insertVerificationDocument(
    companyId: string,
    userId: string,
    dto: SubmitVerificationDto,
  ): Promise<CompanyDocument> {
    const { rows } = await db.query<CompanyDocument>(
      `INSERT INTO company_documents (company_id, document_type, file_url, uploaded_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [companyId, dto.document_type, dto.file_url, userId],
    );
    await db.query(
      `UPDATE companies SET status = 'pending', updated_at = NOW() WHERE id = $1`,
      [companyId],
    );
    return rows[0];
  }

  // ── Ratings ───────────────────────────────────────────────────────────────

  async findDuplicateRating(bookingId: string, reviewerId: string): Promise<boolean> {
    const { rows } = await db.query(
      `SELECT id FROM ratings WHERE booking_id = $1 AND reviewer_id = $2`,
      [bookingId, reviewerId],
    );
    return rows.length > 0;
  }

  async insertRating(reviewerId: string, dto: SubmitRatingDto): Promise<Rating> {
    // Attempt full INSERT with extended criteria columns first.
    // Falls back to core columns if the extended schema migration has not yet run.
    // 42703 = undefined_column in PostgreSQL.
    try {
      const { rows } = await db.query<Rating>(
        `INSERT INTO ratings (
           booking_id, reviewer_id, reviewee_id, score, comment,
           delivery_punctuality, cargo_condition, communication,
           payment_speed, loading_conditions, shipment_accuracy
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          dto.booking_id, reviewerId, dto.reviewee_id, dto.score, dto.comment ?? null,
          dto.delivery_punctuality   ?? null,
          dto.cargo_condition        ?? null,
          dto.communication          ?? null,
          dto.payment_speed          ?? null,
          dto.loading_conditions     ?? null,
          dto.shipment_accuracy      ?? null,
        ],
      );
      return rows[0];
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException & { code?: string }).code !== '42703') throw err;

      console.warn(
        '[WorkspaceRepository.insertRating] Extended criteria columns not found — ' +
        'falling back to core-column INSERT. Run the ratings schema migration to unlock full functionality.',
      );

      const { rows } = await db.query<Rating>(
        `INSERT INTO ratings (booking_id, reviewer_id, reviewee_id, score, comment)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [dto.booking_id, reviewerId, dto.reviewee_id, dto.score, dto.comment ?? null],
      );
      return { ...rows[0], _note: 'Extended rating criteria were ignored — pending schema migration.' } as Rating;
    }
  }

  async findRatingsByCompany(
    companyId: string,
    limit: number,
    offset: number,
  ): Promise<RatingWithReviewer[]> {
    const { rows } = await db.query<RatingWithReviewer>(
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
    return rows;
  }

  async findRatingSummaryByCompany(companyId: string): Promise<RatingSummary> {
    let summaryRow: Partial<RatingSummary>;

    try {
      const { rows } = await db.query(
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
      summaryRow = rows[0];
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException & { code?: string }).code !== '42703') throw err;

      console.warn(
        '[WorkspaceRepository.findRatingSummaryByCompany] Extended criteria columns not found — ' +
        'returning core summary only.',
      );

      const { rows } = await db.query(
        `SELECT COUNT(*) AS total_reviews, ROUND(AVG(r.score)::numeric, 2) AS avg_score
         FROM ratings r
         JOIN users rv ON r.reviewee_id = rv.id
         WHERE rv.company_id = $1`,
        [companyId],
      );
      summaryRow = {
        ...rows[0],
        _note: 'Extended criteria averages unavailable — pending schema migration.',
      };
    }

    const { rows: bookingRows } = await db.query(
      `SELECT
         COUNT(*)                                                          AS total_bookings,
         COUNT(CASE WHEN status = 'completed' THEN 1 END)                 AS completed_bookings,
         ROUND(
           COUNT(CASE WHEN status = 'completed' THEN 1 END)::decimal
             / NULLIF(COUNT(*), 0) * 100, 1
         )                                                                 AS success_rate
       FROM bookings
       WHERE carrier_company_id = $1 OR shipper_company_id = $1`,
      [companyId],
    );

    return { ...summaryRow, ...bookingRows[0] } as RatingSummary;
  }

  // ── Documents ─────────────────────────────────────────────────────────────

  async findDocumentsByUser(userId: string, filters: DocumentFilters): Promise<Document[]> {
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
    const params: unknown[] = [userId];
    let idx = 2;

    if (filters.from)          { query += ` AND d.created_at >= $${idx++}`;               params.push(filters.from); }
    if (filters.to)            { query += ` AND d.created_at <= $${idx++}`;               params.push(filters.to); }
    if (filters.license_plate) { query += ` AND v.license_plate ILIKE $${idx++}`;         params.push(`%${filters.license_plate}%`); }
    if (filters.doc_type)      { query += ` AND d.document_type = $${idx++}`;             params.push(filters.doc_type); }

    query += ` ORDER BY d.created_at DESC`;

    const { rows } = await db.query<Document>(query, params);
    return rows;
  }

  async insertCompanyDocument(
    companyId: string,
    userId: string,
    documentType: string,
    fileUrl: string,
  ): Promise<CompanyDocument> {
    const { rows } = await db.query<CompanyDocument>(
      `INSERT INTO company_documents (company_id, document_type, file_url, uploaded_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [companyId, documentType, fileUrl, userId],
    );
    return rows[0];
  }

  async findCompanyDocuments(companyId: string): Promise<CompanyDocument[]> {
    const { rows } = await db.query<CompanyDocument>(
      `SELECT * FROM company_documents WHERE company_id = $1 ORDER BY created_at DESC`,
      [companyId],
    );
    return rows;
  }
}

export const workspaceRepository = new WorkspaceRepository();
