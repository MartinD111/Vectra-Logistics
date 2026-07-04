// Exception Radar: active operational crises (border delays, port congestion,
// wagon damage, engine faults) per company. Rows come from webhooks and
// integrations (or the demo simulator) and are pushed live to every dispatcher
// in the company room as 'exception:new' / 'exception:resolved'.

import { z } from 'zod';
import { db } from '../../core/db';
import { AppError } from '../../core/errors/AppError';
import { emitToRoom } from '../../core/realtime/bus';

export const EXCEPTION_KINDS = ['border_delay', 'port_congestion', 'wagon_damage', 'engine_fault'] as const;

export const CreateExceptionSchema = z.object({
  kind: z.enum(EXCEPTION_KINDS),
  severity: z.enum(['info', 'warning', 'critical']).default('warning'),
  title: z.string().min(3).max(200),
  detail: z.record(z.string(), z.unknown()).optional(),
});

export interface FleetException {
  id: string;
  company_id: string;
  kind: string;
  severity: string;
  title: string;
  detail: Record<string, unknown>;
  status: string;
  created_at: Date;
  resolved_at: Date | null;
}

// Templates for the demo simulator — lets dispatchers see the live push
// without any connected integration.
const DEMO_TEMPLATES: { kind: (typeof EXCEPTION_KINDS)[number]; severity: 'info' | 'warning' | 'critical'; title: string; detail: Record<string, unknown> }[] = [
  { kind: 'border_delay', severity: 'critical', title: 'Border delay 3h+ at Obrežje (SI→HR)', detail: { border: 'Obrežje', direction: 'SI→HR', wait_minutes: 190 } },
  { kind: 'border_delay', severity: 'warning', title: 'Border delay 2h at Spielfeld (AT→SI)', detail: { border: 'Spielfeld', direction: 'AT→SI', wait_minutes: 125 } },
  { kind: 'port_congestion', severity: 'warning', title: 'Terminal congestion at Port of Koper — container pickup slots delayed', detail: { port: 'Koper', terminal: 'Container', delay_hours: 5 } },
  { kind: 'port_congestion', severity: 'critical', title: 'Vessel bunching in Trieste — reefer plugs at capacity', detail: { port: 'Trieste', delay_hours: 12 } },
  { kind: 'wagon_damage', severity: 'warning', title: 'Wagon 33 56 4661 220-1 damage report — brake shoe worn', detail: { wagon: '33 56 4661 220-1', report: 'CIT7 pending' } },
  { kind: 'engine_fault', severity: 'critical', title: 'Engine fault code SPN 100 (oil pressure) — LJ 222-KR', detail: { plate: 'LJ 222-KR', code: 'SPN 100 FMI 1', source: 'telematics' } },
  { kind: 'engine_fault', severity: 'info', title: 'DEF level low — LJ 333-KR', detail: { plate: 'LJ 333-KR', code: 'SPN 1761', source: 'telematics' } },
];

class ExceptionsService {
  async listActive(companyId: string): Promise<FleetException[]> {
    const { rows } = await db.query<FleetException>(
      `SELECT * FROM fleet_exceptions
       WHERE company_id = $1 AND status = 'active'
       ORDER BY created_at DESC LIMIT 100`,
      [companyId],
    );
    return rows;
  }

  async create(companyId: string, body: unknown): Promise<FleetException> {
    const parsed = CreateExceptionSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    const { kind, severity, title, detail } = parsed.data;
    const { rows } = await db.query<FleetException>(
      `INSERT INTO fleet_exceptions (company_id, kind, severity, title, detail)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [companyId, kind, severity, title, JSON.stringify(detail ?? {})],
    );
    const exception = rows[0];
    emitToRoom(`company:${companyId}`, 'exception:new', exception);
    return exception;
  }

  /** Create a random demo exception — exercises the live radar end-to-end. */
  async simulate(companyId: string): Promise<FleetException> {
    const template = DEMO_TEMPLATES[Math.floor(Math.random() * DEMO_TEMPLATES.length)];
    return this.create(companyId, { ...template, detail: { ...template.detail, demo: true } });
  }

  async resolve(id: string, companyId: string): Promise<FleetException> {
    const { rows } = await db.query<FleetException>(
      `UPDATE fleet_exceptions
       SET status = 'resolved', resolved_at = NOW()
       WHERE id = $1 AND company_id = $2 AND status = 'active'
       RETURNING *`,
      [id, companyId],
    );
    if (!rows[0]) throw new AppError(404, 'Exception not found or already resolved');
    emitToRoom(`company:${companyId}`, 'exception:resolved', { id, resolved_at: rows[0].resolved_at });
    return rows[0];
  }
}

export const exceptionsService = new ExceptionsService();
