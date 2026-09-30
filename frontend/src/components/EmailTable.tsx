'use client';

import { EmailJob } from '@/types';
import { formatDateTime, formatRelative } from '@/lib/utils';
import { Inbox } from 'lucide-react';

interface EmailListProps {
  emails: EmailJob[];
  loading: boolean;
  type: 'scheduled' | 'sent';
  emptyMessage?: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    scheduled: 'badge-scheduled',
    sent: 'badge-sent',
    failed: 'badge-failed',
    delayed: 'badge-delayed',
  };
  const dotMap: Record<string, string> = {
    scheduled: '#D97706',
    sent: '#9CA3AF',
    failed: '#DC2626',
    delayed: '#D97706',
  };
  const cls = map[status] || 'badge-sent';
  return (
    <span className={cls}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotMap[status] || '#9CA3AF', display: 'inline-block' }} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="email-row">
      <div className="email-row-avatar shimmer" />
      <div className="email-row-body">
        <div className="email-row-top">
          <div className="shimmer" style={{ width: 160, height: 13, borderRadius: 4 }} />
          <div className="shimmer" style={{ width: 70, height: 20, borderRadius: 999 }} />
        </div>
        <div className="shimmer" style={{ width: 240, height: 11, borderRadius: 4, marginTop: 4 }} />
      </div>
    </div>
  );
}

export default function EmailList({ emails, loading, type, emptyMessage }: EmailListProps) {
  const isScheduled = type === 'scheduled';

  if (loading) {
    return (
      <div className="email-list">
        {Array.from({ length: 7 }).map((_, i) => <SkeletonRow key={i} />)}
      </div>
    );
  }

  if (!emails.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon-wrap">
          <Inbox style={{ width: 24, height: 24, color: '#9CA3AF' }} />
        </div>
        <p className="empty-title">
          {emptyMessage || (isScheduled ? 'No scheduled emails' : 'No sent emails yet')}
        </p>
        <p className="empty-desc">
          {isScheduled
            ? 'Use the Compose button to schedule your first email campaign.'
            : 'Sent emails will appear here once they\'ve been delivered.'}
        </p>
      </div>
    );
  }

  return (
    <div className="email-list fade-in">
      {emails.map((email) => (
        <div key={email.id} className="email-row">
          <div className="email-row-avatar">
            {email.to_email.charAt(0).toUpperCase()}
          </div>
          <div className="email-row-body">
            <div className="email-row-top">
              <span className="email-row-to">
                To: {email.to_email}
              </span>
              <StatusBadge status={email.status} />
            </div>
            <div className="email-row-subject">
              {email.subject}
              {' · '}
              <span style={{ color: '#9CA3AF' }}>
                {isScheduled ? formatRelative(email.scheduled_at) : formatRelative(email.sent_at)}
                {' · '}
                {isScheduled ? formatDateTime(email.scheduled_at) : formatDateTime(email.sent_at)}
              </span>
            </div>
            {email.error_message && (
              <div style={{ fontSize: 11, color: '#DC2626', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {email.error_message}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
