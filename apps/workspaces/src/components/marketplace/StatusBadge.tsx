import { CheckCircle2, Clock, XCircle, Truck, PackageCheck, Loader2 } from 'lucide-react';

interface Props {
  status: string;
}

const MAP: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  open:        { label: 'Open',        cls: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800', Icon: Clock },
  pending:     { label: 'Pending',     cls: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800', Icon: Loader2 },
  booked:      { label: 'Booked',      cls: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800', Icon: CheckCircle2 },
  assigned:    { label: 'Assigned',    cls: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800', Icon: Truck },
  in_transit:  { label: 'In Transit',  cls: 'bg-primary-100 text-primary-700 border-primary-200 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-800', Icon: Truck },
  delivered:   { label: 'Delivered',   cls: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800', Icon: PackageCheck },
  completed:   { label: 'Completed',   cls: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800', Icon: PackageCheck },
  cancelled:   { label: 'Cancelled',   cls: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800', Icon: XCircle },
};

export default function StatusBadge({ status }: Props) {
  const cfg = MAP[status] ?? { label: status, cls: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600', Icon: Clock };
  const { Icon } = cfg;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.cls}`}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
}
