'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { documentsApi, expiresWithinDays, isExpired } from './documents.api';

/**
 * Aggregate banner showing documents expired or expiring within 30 days.
 * Pulls the full company document list once and filters client-side.
 */
export default function DocumentExpiryBanner() {
  const { data } = useQuery({
    queryKey: ['documents', 'all'],
    queryFn: () => documentsApi.list(),
    staleTime: 60_000,
  });

  if (!data || data.length === 0) return null;

  const expired = data.filter(isExpired);
  const expiring = data.filter((d) => !isExpired(d) && expiresWithinDays(d, 30));
  if (expired.length === 0 && expiring.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 text-sm">
        <p className="font-semibold text-amber-900 dark:text-amber-200">
          {expired.length > 0 && `${expired.length} expired document${expired.length === 1 ? '' : 's'}`}
          {expired.length > 0 && expiring.length > 0 && ' · '}
          {expiring.length > 0 && `${expiring.length} expiring within 30 days`}
        </p>
        <ul className="mt-1 text-xs text-amber-800 dark:text-amber-300 space-y-0.5">
          {[...expired, ...expiring].slice(0, 5).map((d) => {
            const subjectHref =
              d.subject === 'driver' && d.subject_id ? `/drivers/${d.subject_id}`
              : d.subject === 'vehicle' && d.subject_id ? `/vehicles/${d.subject_id}`
              : d.subject === 'shipment' && d.subject_id ? `/shipments/${d.subject_id}`
              : null;
            return (
              <li key={d.id}>
                {d.document_type}
                {d.expires_at && <> · expires {new Date(d.expires_at).toLocaleDateString()}</>}
                {subjectHref && (
                  <> · <Link href={subjectHref} className="underline font-medium">view</Link></>
                )}
              </li>
            );
          })}
          {expired.length + expiring.length > 5 && (
            <li className="italic opacity-70">…and {expired.length + expiring.length - 5} more</li>
          )}
        </ul>
      </div>
    </div>
  );
}
