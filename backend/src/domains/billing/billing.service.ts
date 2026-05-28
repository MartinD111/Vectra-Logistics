import { db } from '../../core/db';
import { AppError } from '../../core/errors/AppError';
import { Settlement } from './billing.types';

// ── Settlement config ─────────────────────────────────────────────────────────
//
// settlements schema (run once in a migration):
//
//   CREATE TABLE IF NOT EXISTS settlements (
//     id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//     shipment_id       UUID NOT NULL REFERENCES shipments(id),
//     company_id        UUID NOT NULL,
//     driver_id         UUID REFERENCES drivers(id),
//     gross_amount_eur  NUMERIC(12,2) NOT NULL,
//     driver_share_pct  NUMERIC(5,2)  NOT NULL DEFAULT 85,
//     settlement_amount NUMERIC(12,2) NOT NULL,
//     platform_fee      NUMERIC(12,2) NOT NULL,
//     settlement_status TEXT NOT NULL DEFAULT 'pending'
//       CHECK (settlement_status IN ('pending','approved','paid')),
//     created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//     updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
//   );
//
//   CREATE UNIQUE INDEX IF NOT EXISTS settlements_shipment_id_idx
//     ON settlements (shipment_id);

const DEFAULT_DRIVER_SHARE_PCT = 85; // carrier keeps 85 %, platform takes 15 %
const PLATFORM_FEE_PCT         = 100 - DEFAULT_DRIVER_SHARE_PCT;

class BillingService {
  // ── Calculate & persist settlement ────────────────────────────────────────

  async createSettlement(opts: {
    shipmentId:    string;
    companyId:     string;
    driverId?:     string;
    grossAmountEur: number;
    driverSharePct?: number;
  }): Promise<Settlement> {
    const sharePct         = opts.driverSharePct ?? DEFAULT_DRIVER_SHARE_PCT;
    const settlementAmount = parseFloat(((opts.grossAmountEur * sharePct) / 100).toFixed(2));
    const platformFee      = parseFloat(((opts.grossAmountEur * PLATFORM_FEE_PCT) / 100).toFixed(2));

    const { rows } = await db.query<Settlement>(
      `INSERT INTO settlements (
         shipment_id, company_id, driver_id,
         gross_amount_eur, driver_share_pct,
         settlement_amount, platform_fee,
         settlement_status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       ON CONFLICT (shipment_id) DO UPDATE
         SET gross_amount_eur  = EXCLUDED.gross_amount_eur,
             driver_share_pct  = EXCLUDED.driver_share_pct,
             settlement_amount = EXCLUDED.settlement_amount,
             platform_fee      = EXCLUDED.platform_fee,
             updated_at        = NOW()
       RETURNING *`,
      [
        opts.shipmentId,
        opts.companyId,
        opts.driverId ?? null,
        opts.grossAmountEur,
        sharePct,
        settlementAmount,
        platformFee,
      ],
    );

    return rows[0];
  }

  // ── Fetch settlement for a single shipment ────────────────────────────────

  async getSettlementByShipment(shipmentId: string): Promise<Settlement | null> {
    const { rows } = await db.query<Settlement>(
      `SELECT * FROM settlements WHERE shipment_id = $1 LIMIT 1`,
      [shipmentId],
    );
    return rows[0] ?? null;
  }

  // ── Fetch all settlements for a company ────────────────────────────────────

  async getSettlementsByCompany(companyId: string): Promise<Settlement[]> {
    const { rows } = await db.query<Settlement>(
      `SELECT * FROM settlements WHERE company_id = $1 ORDER BY created_at DESC`,
      [companyId],
    );
    return rows;
  }

  // ── Approve / mark paid ────────────────────────────────────────────────────

  async updateSettlementStatus(
    shipmentId: string,
    companyId: string,
    status: Settlement['settlement_status'],
  ): Promise<Settlement> {
    const { rows } = await db.query<Settlement>(
      `UPDATE settlements
       SET settlement_status = $1, updated_at = NOW()
       WHERE shipment_id = $2 AND company_id = $3
       RETURNING *`,
      [status, shipmentId, companyId],
    );
    if (rows.length === 0) throw new AppError(404, 'Settlement not found');
    return rows[0];
  }
}

export const billingService = new BillingService();
