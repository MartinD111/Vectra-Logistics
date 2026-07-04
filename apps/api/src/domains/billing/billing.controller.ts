import { Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { invoicingService } from './invoicing.service';

const requireCompany = (req: AuthRequest): string => {
  const companyId = req.user?.company_id;
  if (!companyId) throw new AppError(403, 'No company associated');
  return companyId;
};

export const listClients = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ clients: await invoicingService.listClients(requireCompany(req)) });
});

export const createClient = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(201).json({ client: await invoicingService.createClient(requireCompany(req), req.body) });
});

export const updateClient = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ client: await invoicingService.updateClient(req.params.id, requireCompany(req), req.body) });
});

export const evaluateVat = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ vat: await invoicingService.evaluateVatFor(requireCompany(req), req.body) });
});

export const listInvoices = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ invoices: await invoicingService.listInvoices(requireCompany(req)) });
});

export const approveInvoice = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ invoice: await invoicingService.approveInvoice(req.params.id, requireCompany(req), req.user?.id ?? null) });
});

export const markInvoicePaid = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ invoice: await invoicingService.markPaid(req.params.id, requireCompany(req), req.user?.id ?? null) });
});
