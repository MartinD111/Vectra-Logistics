import { AppError } from '../../core/errors/AppError';
import { workspaceRepository } from './workspace.repository';
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
import { SubmitRatingSchema } from './dto/submit-rating.dto';
import { SubmitVerificationSchema } from './dto/submit-verification.dto';
import { DocumentFiltersSchema } from './dto/document-filters.dto';

class WorkspaceService {
  // ── Company ───────────────────────────────────────────────────────────────

  async getCompanyBusinessCard(companyId: string): Promise<CompanyBusinessCard> {
    const card = await workspaceRepository.findCompanyBusinessCard(companyId);
    if (!card) throw new AppError(404, 'Company not found');
    return card;
  }

  async getVerificationStatus(
    companyId: string,
    requestingCompanyId: string | null,
    requestingRole: string,
  ): Promise<CompanyVerificationStatus> {
    if (companyId !== requestingCompanyId && requestingRole !== 'admin') {
      throw new AppError(403, 'Forbidden');
    }
    const status = await workspaceRepository.findCompanyVerificationStatus(companyId);
    if (!status) throw new AppError(404, 'Company not found');
    return status;
  }

  async submitVerification(
    companyId: string,
    userId: string,
    body: unknown,
  ): Promise<{ document: CompanyDocument; message: string }> {
    const parsed = SubmitVerificationSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);

    const document = await workspaceRepository.insertVerificationDocument(
      companyId,
      userId,
      parsed.data,
    );
    return {
      document,
      message: 'Verification document submitted successfully. It is now under review.',
    };
  }

  // ── Ratings ───────────────────────────────────────────────────────────────

  async submitRating(reviewerId: string, body: unknown): Promise<Rating> {
    const parsed = SubmitRatingSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);

    const isDuplicate = await workspaceRepository.findDuplicateRating(
      parsed.data.booking_id,
      reviewerId,
    );
    if (isDuplicate) throw new AppError(409, 'You have already rated this booking');

    return workspaceRepository.insertRating(reviewerId, parsed.data);
  }

  async getCompanyRatings(
    companyId: string,
    page: number,
    limit: number,
  ): Promise<{ ratings: RatingWithReviewer[]; page: number; limit: number }> {
    const offset = (page - 1) * limit;
    const ratings = await workspaceRepository.findRatingsByCompany(companyId, limit, offset);
    return { ratings, page, limit };
  }

  async getCompanyRatingSummary(companyId: string): Promise<RatingSummary> {
    return workspaceRepository.findRatingSummaryByCompany(companyId);
  }

  // ── Documents ─────────────────────────────────────────────────────────────

  async getDocuments(userId: string, rawFilters: unknown): Promise<Document[]> {
    const parsed = DocumentFiltersSchema.safeParse(rawFilters);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    return workspaceRepository.findDocumentsByUser(userId, parsed.data);
  }

  async uploadCompanyDocument(
    companyId: string,
    userId: string,
    documentType: string,
    fileUrl: string,
  ): Promise<CompanyDocument> {
    return workspaceRepository.insertCompanyDocument(companyId, userId, documentType, fileUrl);
  }

  async getCompanyDocuments(companyId: string): Promise<CompanyDocument[]> {
    return workspaceRepository.findCompanyDocuments(companyId);
  }
}

export const workspaceService = new WorkspaceService();
