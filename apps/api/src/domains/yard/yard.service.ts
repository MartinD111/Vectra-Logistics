// Spatial yard management: a 2D floor plan of zones + slots + assets (Leaflet
// CRS.Simple on the frontend), plus the railway terminal board. Follows the
// demo-mode pattern: a company with no yard yet gets a realistic demo yard on
// first load so the block works immediately. The gate check-in logic here is
// shared by the ANPR (plate) and OCR (container) webhooks.

import { z } from 'zod';
import { AppError } from '../../core/errors/AppError';
import { emitToRoom } from '../../core/realtime/bus';
import { recordEvent } from '../../core/events/activityLog';
import {
  yardRepository, YardZone, YardSlot, YardAsset, RailWagon,
} from './yard.repository';

export const ZONE_KINDS = ['pallet_rack', 'car_lot', 'teu_container', 'truck_parking'] as const;

const ZONE_COLOR: Record<string, string> = {
  pallet_rack: '#f59e0b',
  car_lot: '#3b82f6',
  teu_container: '#8b5cf6',
  truck_parking: '#10b981',
};

export const CreateZoneSchema = z.object({
  name: z.string().min(1).max(80),
  kind: z.enum(ZONE_KINDS),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().min(20).max(1000).optional(),
  height: z.number().min(20).max(1000).optional(),
  project_id: z.string().uuid().nullable().optional(),
  slots: z.number().int().min(0).max(40).optional(),
});

export const CreateAssetSchema = z.object({
  kind: z.enum(['truck', 'container', 'trailer', 'wagon']),
  label: z.string().min(1).max(80),
  identifier: z.string().max(80).nullable().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  project_id: z.string().uuid().nullable().optional(),
});

export const MoveAssetSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  slot_id: z.string().uuid().nullable().optional(),
});

export const CreateWagonSchema = z.object({
  wagon_number: z.string().min(1).max(60),
  status: z.enum(['in_port', 'loading_sequence', 'in_transit', 'discharging']).optional(),
  cargo: z.string().max(120).nullable().optional(),
  reference: z.string().max(80).nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
});

export const UpdateWagonSchema = z.object({
  status: z.enum(['in_port', 'loading_sequence', 'in_transit', 'discharging']).optional(),
  seq: z.number().int().optional(),
  cargo: z.string().max(120).nullable().optional(),
  reference: z.string().max(80).nullable().optional(),
});

export interface YardLayout {
  demo: boolean;
  extent: { width: number; height: number };
  zones: YardZone[];
  slots: YardSlot[];
  assets: YardAsset[];
}

const YARD_EXTENT = { width: 1000, height: 650 };

class YardService {
  // ── Layout ──
  async getLayout(companyId: string, projectId?: string): Promise<YardLayout> {
    let zones = await yardRepository.listZones(companyId, projectId);
    let demo = false;
    if (zones.length === 0 && !projectId) {
      await this.seedDemoYard(companyId);
      zones = await yardRepository.listZones(companyId);
      demo = true;
    }
    const [slots, assets] = await Promise.all([
      yardRepository.listSlots(companyId, projectId),
      yardRepository.listAssets(companyId, projectId),
    ]);
    return { demo, extent: YARD_EXTENT, zones, slots, assets };
  }

  private async seedDemoYard(companyId: string): Promise<void> {
    const zoneDefs: { name: string; kind: (typeof ZONE_KINDS)[number]; x: number; y: number; width: number; height: number; cols: number; rows: number }[] = [
      { name: 'Truck Parking', kind: 'truck_parking', x: 40, y: 40, width: 440, height: 240, cols: 4, rows: 2 },
      { name: 'TEU Containers', kind: 'teu_container', x: 520, y: 40, width: 440, height: 240, cols: 5, rows: 3 },
      { name: 'Pallet Racks', kind: 'pallet_rack', x: 40, y: 320, width: 440, height: 290, cols: 4, rows: 3 },
      { name: 'Car Lot', kind: 'car_lot', x: 520, y: 320, width: 440, height: 290, cols: 5, rows: 2 },
    ];
    for (const def of zoneDefs) {
      const zone = await yardRepository.createZone({
        company_id: companyId, project_id: null, name: def.name, kind: def.kind,
        color: ZONE_COLOR[def.kind], x: def.x, y: def.y, width: def.width, height: def.height, polygon: null,
      });
      const padX = 30, padY = 40;
      const cellW = (def.width - padX * 2) / def.cols;
      const cellH = (def.height - padY * 2) / def.rows;
      let n = 1;
      for (let r = 0; r < def.rows; r++) {
        for (let c = 0; c < def.cols; c++) {
          await yardRepository.createSlot({
            company_id: companyId, zone_id: zone.id,
            label: `${def.name.split(' ').map((w) => w[0]).join('')}${n}`,
            x: def.x + padX + cellW * c + cellW / 2,
            y: def.y + padY + cellH * r + cellH / 2,
            status: 'free',
          });
          n++;
        }
      }
    }
  }

  // ── Zones ──
  async createZone(companyId: string, body: unknown): Promise<YardZone> {
    const parsed = CreateZoneSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    const d = parsed.data;
    const width = d.width ?? 300, height = d.height ?? 200;
    const zone = await yardRepository.createZone({
      company_id: companyId, project_id: d.project_id ?? null, name: d.name, kind: d.kind,
      color: ZONE_COLOR[d.kind], x: d.x ?? 60, y: d.y ?? 60, width, height, polygon: null,
    });
    // Auto-generate a grid of slots.
    const slotCount = d.slots ?? 6;
    if (slotCount > 0) {
      const cols = Math.ceil(Math.sqrt(slotCount * (width / height)));
      const rows = Math.ceil(slotCount / cols);
      const padX = 30, padY = 40;
      const cellW = (width - padX * 2) / cols;
      const cellH = (height - padY * 2) / rows;
      let n = 1;
      for (let r = 0; r < rows && n <= slotCount; r++) {
        for (let c = 0; c < cols && n <= slotCount; c++) {
          await yardRepository.createSlot({
            company_id: companyId, zone_id: zone.id, label: `${d.name.slice(0, 3).toUpperCase()}${n}`,
            x: (d.x ?? 60) + padX + cellW * c + cellW / 2,
            y: (d.y ?? 60) + padY + cellH * r + cellH / 2,
            status: 'free',
          });
          n++;
        }
      }
    }
    emitToRoom(`company:${companyId}`, 'yard:zone', zone);
    return zone;
  }

  async deleteZone(id: string, companyId: string): Promise<void> {
    const ok = await yardRepository.deleteZone(id, companyId);
    if (!ok) throw new AppError(404, 'Zone not found');
    emitToRoom(`company:${companyId}`, 'yard:zone-deleted', { id });
  }

  // ── Assets ──
  async createAsset(companyId: string, body: unknown): Promise<YardAsset> {
    const parsed = CreateAssetSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    const d = parsed.data;
    const asset = await yardRepository.createAsset({
      company_id: companyId, project_id: d.project_id ?? null, kind: d.kind, label: d.label,
      identifier: d.identifier ?? null, slot_id: null, x: d.x ?? 20, y: d.y ?? 20,
      status: 'in_yard', source: 'manual', metadata: {},
    });
    emitToRoom(`company:${companyId}`, 'yard:asset', asset);
    return asset;
  }

  /** Move an asset: free-position, or drop onto a slot (marks slots occupied/free). */
  async moveAsset(id: string, companyId: string, body: unknown): Promise<YardAsset> {
    const existing = await yardRepository.findAsset(id, companyId);
    if (!existing) throw new AppError(404, 'Asset not found');
    const parsed = MoveAssetSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    const d = parsed.data;

    // Slot occupancy bookkeeping when the assignment changes.
    if (d.slot_id !== undefined && d.slot_id !== existing.slot_id) {
      if (existing.slot_id) await yardRepository.setSlotStatus(existing.slot_id, 'free');
      if (d.slot_id) await yardRepository.setSlotStatus(d.slot_id, 'occupied');
    }
    const updated = await yardRepository.updateAsset(id, companyId, {
      x: d.x, y: d.y, slot_id: d.slot_id, status: existing.status,
    });
    if (!updated) throw new AppError(404, 'Asset not found');
    emitToRoom(`company:${companyId}`, 'yard:asset', updated);
    return updated;
  }

  /**
   * Gate check-in used by the ANPR/OCR webhooks: find-or-create the asset, mark
   * it gate_in, and auto-assign it to the first free slot of a matching zone.
   */
  async gateCheckIn(companyId: string, input: {
    kind: 'truck' | 'container'; identifier: string; label?: string; source: 'gate_anpr' | 'gate_ocr'; gate?: string;
  }): Promise<{ asset: YardAsset; assignedSlot: YardSlot | null }> {
    // Ensure a yard exists so there are slots to assign into.
    if ((await yardRepository.countZones(companyId)) === 0) await this.seedDemoYard(companyId);

    const zoneKinds = input.kind === 'truck' ? ['truck_parking'] : ['teu_container'];
    const slot = await yardRepository.firstFreeSlot(companyId, zoneKinds);

    let asset = await yardRepository.findAssetByIdentifier(companyId, input.identifier);
    if (asset) {
      if (asset.slot_id && asset.slot_id !== slot?.id) await yardRepository.setSlotStatus(asset.slot_id, 'free');
      asset = (await yardRepository.updateAsset(asset.id, companyId, {
        slot_id: slot?.id ?? null, x: slot?.x ?? asset.x, y: slot?.y ?? asset.y, status: 'gate_in',
      }))!;
    } else {
      asset = await yardRepository.createAsset({
        company_id: companyId, project_id: null, kind: input.kind,
        label: input.label ?? input.identifier, identifier: input.identifier,
        slot_id: slot?.id ?? null, x: slot?.x ?? 20, y: slot?.y ?? 20,
        status: 'gate_in', source: input.source, metadata: { gate: input.gate ?? null },
      });
    }
    if (slot) await yardRepository.setSlotStatus(slot.id, 'occupied');

    emitToRoom(`company:${companyId}`, 'yard:asset', asset);
    await recordEvent({
      tenantId: companyId, verb: 'yard.gate.checkin', objectType: 'yard_asset', objectId: asset.id,
      payload: { identifier: input.identifier, source: input.source, slot: slot?.label ?? null },
    });
    return { asset, assignedSlot: slot };
  }

  // ── Rail wagons ──
  async listWagons(companyId: string, projectId?: string): Promise<RailWagon[]> {
    let wagons = await yardRepository.listWagons(companyId, projectId);
    if (wagons.length === 0 && !projectId && (await yardRepository.countWagons(companyId)) === 0) {
      await this.seedDemoWagons(companyId);
      wagons = await yardRepository.listWagons(companyId);
    }
    return wagons;
  }

  private async seedDemoWagons(companyId: string): Promise<void> {
    const defs: { wagon_number: string; status: string; cargo: string }[] = [
      { wagon_number: '33 56 4661 220-1', status: 'in_port', cargo: 'Steel coils' },
      { wagon_number: '33 56 4661 221-9', status: 'in_port', cargo: 'Timber' },
      { wagon_number: '31 81 4675 118-2', status: 'loading_sequence', cargo: 'Containers 2×20ft' },
      { wagon_number: '33 56 4661 222-7', status: 'loading_sequence', cargo: 'Machinery' },
      { wagon_number: '37 84 7838 442-0', status: 'in_transit', cargo: 'Automotive parts' },
      { wagon_number: '33 56 4661 223-5', status: 'discharging', cargo: 'Grain' },
    ];
    let seq = 0;
    for (const d of defs) {
      await yardRepository.createWagon({
        company_id: companyId, project_id: null, wagon_number: d.wagon_number,
        status: d.status, seq: seq++, cargo: d.cargo, reference: null, metadata: { demo: true },
      });
    }
  }

  async createWagon(companyId: string, body: unknown): Promise<RailWagon> {
    const parsed = CreateWagonSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    const d = parsed.data;
    const wagon = await yardRepository.createWagon({
      company_id: companyId, project_id: d.project_id ?? null, wagon_number: d.wagon_number,
      status: d.status ?? 'in_port', seq: 0, cargo: d.cargo ?? null, reference: d.reference ?? null, metadata: {},
    });
    emitToRoom(`company:${companyId}`, 'yard:wagon', wagon);
    return wagon;
  }

  async updateWagon(id: string, companyId: string, body: unknown): Promise<RailWagon> {
    const parsed = UpdateWagonSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    const updated = await yardRepository.updateWagon(id, companyId, parsed.data);
    if (!updated) throw new AppError(404, 'Wagon not found');
    emitToRoom(`company:${companyId}`, 'yard:wagon', updated);
    return updated;
  }
}

export const yardService = new YardService();
