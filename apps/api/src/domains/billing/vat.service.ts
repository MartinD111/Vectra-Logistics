// Smart VAT matrix for B2B road/rail transport services (general place-of-
// supply rule, Art. 44 of Directive 2006/112/EC: supplied where the customer
// is established). Deterministic — no external VIES call yet; the VAT ID is
// format-checked and the treatment decided from supplier/client countries:
//
//   client in supplier's country            → standard VAT (supplier rate)
//   client in another EU state, valid VAT ID → EU reverse charge (0%)
//   client outside the EU                    → 0% (outside EU VAT scope / export)
//   client in EU without a valid VAT ID      → standard VAT (supplier rate)

export type VatTreatment = 'standard' | 'reverse_charge' | 'export_zero';

export interface VatResult {
  treatment: VatTreatment;
  rate: number;          // percent, e.g. 22
  note: string;
  vat_id_valid: boolean;
  supplier_country: string;
  client_country: string;
}

const EU = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

/** Standard VAT rates (%). */
const STANDARD_RATE: Record<string, number> = {
  SI: 22, DE: 19, AT: 20, IT: 22, HR: 25, HU: 27, FR: 20, NL: 21, BE: 21,
  PL: 23, CZ: 21, SK: 23, ES: 21, RO: 19, BG: 20, GR: 24, PT: 23, IE: 23,
  DK: 25, SE: 25, FI: 25.5, LU: 17, LT: 21, LV: 21, EE: 24, CY: 19, MT: 18,
};

/** Free-text country names (companies.country) → ISO-2. */
const NAME_TO_ISO: Record<string, string> = {
  slovenia: 'SI', croatia: 'HR', germany: 'DE', austria: 'AT', italy: 'IT',
  hungary: 'HU', france: 'FR', netherlands: 'NL', belgium: 'BE', poland: 'PL',
  czechia: 'CZ', 'czech republic': 'CZ', slovakia: 'SK', spain: 'ES',
  romania: 'RO', bulgaria: 'BG', greece: 'GR', serbia: 'RS', switzerland: 'CH',
  'united kingdom': 'GB', turkey: 'TR',
};

export function toIso2(country: string | null | undefined, fallback = 'SI'): string {
  if (!country) return fallback;
  const trimmed = country.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return NAME_TO_ISO[trimmed.toLowerCase()] ?? fallback;
}

/** Format check: 2-letter prefix matching the country + 2–12 alphanumerics. */
export function isVatIdValid(vatId: string | null | undefined, country: string): boolean {
  if (!vatId) return false;
  const v = vatId.replace(/[\s.-]/g, '').toUpperCase();
  if (!/^[A-Z]{2}[0-9A-Z]{2,12}$/.test(v)) return false;
  // Greece uses the EL prefix.
  const prefix = country === 'GR' ? 'EL' : country;
  return v.startsWith(prefix);
}

export function evaluateVat(input: {
  supplier_country: string;
  client_country: string;
  client_vat_id?: string | null;
}): VatResult {
  const supplier = toIso2(input.supplier_country);
  // Unknown client countries fall back to 'XX' (non-EU) — safer to 0%-flag an
  // unrecognised country for human review than to assume a domestic supply.
  const client = toIso2(input.client_country, 'XX');
  const vatIdValid = isVatIdValid(input.client_vat_id, client);
  const supplierRate = STANDARD_RATE[supplier] ?? 20;

  if (client === supplier) {
    return {
      treatment: 'standard', rate: supplierRate,
      note: `Domestic supply — standard ${supplier} VAT ${supplierRate}%.`,
      vat_id_valid: vatIdValid, supplier_country: supplier, client_country: client,
    };
  }
  if (EU.has(client)) {
    if (vatIdValid) {
      return {
        treatment: 'reverse_charge', rate: 0,
        note: 'EU B2B — reverse charge, VAT payable by the recipient (Art. 196 / place of supply Art. 44, Directive 2006/112/EC).',
        vat_id_valid: true, supplier_country: supplier, client_country: client,
      };
    }
    return {
      treatment: 'standard', rate: supplierRate,
      note: `EU client without a valid VAT ID — supplier-country VAT ${supplierRate}% applies. Verify the client's VAT number.`,
      vat_id_valid: false, supplier_country: supplier, client_country: client,
    };
  }
  return {
    treatment: 'export_zero', rate: 0,
    note: 'Client established outside the EU — outside the scope of EU VAT (0%).',
    vat_id_valid: vatIdValid, supplier_country: supplier, client_country: client,
  };
}
