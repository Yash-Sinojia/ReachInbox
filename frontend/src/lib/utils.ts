import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy HH:mm');
  } catch {
    return dateStr;
  }
}

export function formatRelative(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

/**
 * Parse CSV or newline-separated email addresses from text content.
 * Returns unique, valid-looking email addresses.
 */
export function parseEmailsFromText(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  // Deduplicate
  return [...new Set(matches.map((e) => e.toLowerCase().trim()))];
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'sent':
      return 'text-emerald-400 bg-emerald-400/10';
    case 'scheduled':
      return 'text-blue-400 bg-blue-400/10';
    case 'failed':
      return 'text-red-400 bg-red-400/10';
    case 'delayed':
      return 'text-amber-400 bg-amber-400/10';
    default:
      return 'text-slate-400 bg-slate-400/10';
  }
}

export function getStatusDot(status: string): string {
  switch (status) {
    case 'sent':
      return 'bg-emerald-400';
    case 'scheduled':
      return 'bg-blue-400';
    case 'failed':
      return 'bg-red-400';
    case 'delayed':
      return 'bg-amber-400';
    default:
      return 'bg-slate-400';
  }
}
