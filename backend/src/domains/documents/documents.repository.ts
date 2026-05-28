import { db } from '../../core/db';

export interface DocumentRecord {
  id: string;
  subject: string;
  subject_id: string | null;
  document_type: string;
  file_url: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  issued_at: Date | null;
  expires_at: Date | null;
  uploaded_by: string;
  company_id: string;
  created_at: Date;
}

export interface InsertDocumentInput {
  subject: string;
  subjectId: string | null;
  documentType: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  issuedAt: string | null;
  expiresAt: string | null;
  uploadedBy: string;
  companyId: string;
}

class DocumentsRepository {
  /**
   * Schema (apply in a migration):
   *
   *   CREATE TABLE IF NOT EXISTS documents (
   *     id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   *     subject         TEXT NOT NULL,
   *     subject_id      UUID,
   *     document_type   TEXT NOT NULL,
   *     file_url        TEXT NOT NULL,
   *     file_name       TEXT,
   *     mime_type       TEXT,
   *     size_bytes      INTEGER,
   *     issued_at       DATE,
   *     expires_at      DATE,
   *     uploaded_by     UUID NOT NULL REFERENCES users(id),
   *     company_id      UUID NOT NULL,
   *     created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
   *   );
   *   CREATE INDEX IF NOT EXISTS documents_subject_idx ON documents (subject, subject_id);
   *   CREATE INDEX IF NOT EXISTS documents_company_idx ON documents (company_id);
   */

  async list(companyId: string, filters: { subject?: string; subjectId?: string; documentType?: string }): Promise<DocumentRecord[]> {
    const conditions = ['company_id = $1'];
    const params: unknown[] = [companyId];
    let i = 2;
    if (filters.subject) { conditions.push(`subject = $${i++}`); params.push(filters.subject); }
    if (filters.subjectId) { conditions.push(`subject_id = $${i++}`); params.push(filters.subjectId); }
    if (filters.documentType) { conditions.push(`document_type = $${i++}`); params.push(filters.documentType); }

    const { rows } = await db.query<DocumentRecord>(
      `SELECT * FROM documents WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
      params,
    );
    return rows;
  }

  async insert(input: InsertDocumentInput): Promise<DocumentRecord> {
    const { rows } = await db.query<DocumentRecord>(
      `INSERT INTO documents (
        subject, subject_id, document_type, file_url, file_name, mime_type, size_bytes,
        issued_at, expires_at, uploaded_by, company_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        input.subject, input.subjectId, input.documentType, input.fileUrl,
        input.fileName, input.mimeType, input.sizeBytes,
        input.issuedAt, input.expiresAt, input.uploadedBy, input.companyId,
      ],
    );
    return rows[0];
  }

  async delete(id: string, companyId: string): Promise<boolean> {
    const { rowCount } = await db.query(
      `DELETE FROM documents WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    return (rowCount ?? 0) > 0;
  }
}

export const documentsRepository = new DocumentsRepository();
