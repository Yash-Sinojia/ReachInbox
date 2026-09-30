'use client';

import { useState, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Paperclip, ChevronDown, Bold, Italic, Underline, Link, List, AlignLeft, AlignCenter, Image, Type, CornerDownLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { emailsApi } from '@/lib/api';
import { Sender } from '@/types';
import { parseEmailsFromText } from '@/lib/utils';

const schema = z.object({
  sender_id: z.string().min(1, 'Please select a sender'),
  subject: z.string().min(1, 'Subject is required').max(200),
  body: z.string().min(1, 'Email body is required'),
  scheduled_at: z.string().min(1, 'Schedule time is required'),
  delay_between_emails: z.number().min(1).max(3600),
  hourly_limit: z.number().min(1).max(1000),
});

type FormData = z.infer<typeof schema>;

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  senders: Sender[];
  onSuccess: () => void;
}

/**
 * Convert a Date to the "YYYY-MM-DDTHH:mm" string that
 * <input type="datetime-local"> expects — in LOCAL time, not UTC.
 * toISOString() always returns UTC, which causes the wrong time to
 * be pre-filled for users in non-UTC timezones (e.g. IST = UTC+5:30).
 */
function toLocalISOString(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000; // getTimezoneOffset() returns minutes
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export default function ComposeModal({ isOpen, onClose, senders, onSuccess }: ComposeModalProps) {
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState('');
  const [recipientError, setRecipientError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSendLater, setShowSendLater] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      delay_between_emails: 2,
      hourly_limit: 50,
      // Default to 5 minutes from now, in LOCAL time so the input displays correctly
      scheduled_at: toLocalISOString(new Date(Date.now() + 5 * 60 * 1000)),
    },
  });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const parsed = parseEmailsFromText(text);
      if (parsed.length === 0) {
        setRecipientError('No valid emails found in file');
      } else {
        setRecipients(parsed);
        setRecipientError('');
        toast.success(`Loaded ${parsed.length} recipients`);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleRecipientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = recipientInput.trim().replace(/,$/, '');
      if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        setRecipients(prev => [...prev, val]);
        setRecipientInput('');
        setRecipientError('');
      } else if (val) {
        setRecipientError('Invalid email address');
      }
    }
  };

  const removeRecipient = (i: number) => {
    setRecipients(prev => prev.filter((_, idx) => idx !== i));
  };

  const onSubmit = async (data: FormData) => {
    if (recipients.length === 0) {
      setRecipientError('Add at least one recipient');
      return;
    }
    setSubmitting(true);
    try {
      const result = await emailsApi.schedule({
        ...data,
        recipients,
        scheduled_at: new Date(data.scheduled_at).toISOString(),
      });
      toast.success(result.message || `${recipients.length} emails scheduled!`);
      reset();
      setRecipients([]);
      setRecipientInput('');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to schedule emails');
    } finally {
      setSubmitting(false);
    }
  };

  const setSendLaterPreset = (minutesFromNow: number) => {
    const d = new Date(Date.now() + minutesFromNow * 60 * 1000);
    // Use local time string so the datetime-local input shows the correct value
    setValue('scheduled_at', toLocalISOString(d));
    setShowSendLater(false);
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* Header */}
        <div className="compose-header">
          <span className="compose-title">Compose New Email</span>

          {/* Controls in header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#6B7280' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontWeight: 500 }}>Delay between emails</label>
              <input
                {...register('delay_between_emails', { valueAsNumber: true })}
                type="number"
                min={1}
                max={3600}
                className="compose-control-input"
                style={{ width: 48 }}
              />
              <span>s</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontWeight: 500 }}>Hourly Limit</label>
              <input
                {...register('hourly_limit', { valueAsNumber: true })}
                type="number"
                min={1}
                max={1000}
                className="compose-control-input"
                style={{ width: 56 }}
              />
            </div>
          </div>

          {/* Send Later + Send buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowSendLater(v => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '7px 12px',
                borderRadius: 8,
                border: '1px solid #E5E7EB',
                background: '#FFFFFF',
                color: '#374151',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Send Later <ChevronDown style={{ width: 14, height: 14 }} />
            </button>

            {showSendLater && (
              <div className="send-later-popover">
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Schedule for</div>
                {[
                  { label: 'In 30 minutes', minutes: 30 },
                  { label: 'In 1 hour', minutes: 60 },
                  { label: 'In 3 hours', minutes: 180 },
                  { label: 'Tomorrow morning', minutes: 60 * 20 },
                  { label: 'Tomorrow afternoon', minutes: 60 * 26 },
                ].map(({ label, minutes }) => (
                  <div key={label} className="send-later-preset" onClick={() => setSendLaterPreset(minutes)}>
                    {label}
                  </div>
                ))}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F3F4F6' }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Custom date & time</label>
                  <input
                    {...register('scheduled_at')}
                    type="datetime-local"
                    className="compose-control-input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              id="schedule-emails-btn"
              disabled={submitting || senders.length === 0}
              className="btn-green"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {submitting ? 'Scheduling...' : `Send ${recipients.length > 0 ? `(${recipients.length})` : ''}`}
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{ padding: 7, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#6B7280' }}
            >
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="compose-body">
          {/* From */}
          <div className="compose-field-row">
            <span className="compose-field-label">From</span>
            {senders.length === 0 ? (
              <span style={{ fontSize: 13, color: '#D97706' }}>No senders — create one first</span>
            ) : (
              <select
                {...register('sender_id')}
                className="compose-field-input"
                style={{ cursor: 'pointer' }}
              >
                <option value="">Select sender...</option>
                {senders.map(s => (
                  <option key={s.id} value={s.id}>{s.email}</option>
                ))}
              </select>
            )}
            {errors.sender_id && (
              <span style={{ fontSize: 11, color: '#DC2626' }}>{errors.sender_id.message}</span>
            )}
          </div>

          {/* To */}
          <div className="compose-field-row" style={{ flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span className="compose-field-label" style={{ alignSelf: 'flex-start', paddingTop: 4 }}>To</span>
            <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 4, minWidth: 0, alignItems: 'center' }}>
              {recipients.map((r, i) => (
                <span key={i} className="recipient-chip">
                  {r}
                  <button type="button" onClick={() => removeRecipient(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#00A859', padding: 0, display: 'flex', lineHeight: 1 }}>
                    <X style={{ width: 10, height: 10 }} />
                  </button>
                </span>
              ))}
              <input
                type="email"
                placeholder="Add email, press Enter..."
                value={recipientInput}
                onChange={e => setRecipientInput(e.target.value)}
                onKeyDown={handleRecipientKeyDown}
                className="compose-field-input"
                style={{ minWidth: 180, flex: 1 }}
              />
            </div>

            {/* Upload list button */}
            <button type="button" className="upload-list-btn" onClick={() => fileRef.current?.click()}>
              <Paperclip style={{ width: 11, height: 11 }} />
              Upload List
            </button>
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" style={{ display: 'none' }} onChange={handleFileUpload} />

            {recipientError && (
              <span style={{ width: '100%', fontSize: 11, color: '#DC2626', paddingLeft: 68 }}>{recipientError}</span>
            )}
          </div>

          {/* Subject */}
          <div className="compose-field-row">
            <span className="compose-field-label">Subject</span>
            <input
              {...register('subject')}
              type="text"
              placeholder="No Subject"
              className="compose-field-input"
            />
            {errors.subject && (
              <span style={{ fontSize: 11, color: '#DC2626' }}>{errors.subject.message}</span>
            )}
          </div>

          {/* Toolbar */}
          <div className="compose-toolbar">
            {[
              [Bold, 'B'], [Italic, 'I'], [Underline, 'U'],
            ].map(([Icon, label], i) => (
              <button key={i} type="button" className="toolbar-btn" title={label as string}>
                <Icon style={{ width: 13, height: 13 }} />
              </button>
            ))}
            <div className="toolbar-divider" />
            {[
              [AlignLeft, 'Align Left'],
              [AlignCenter, 'Align Center'],
            ].map(([Icon, label], i) => (
              <button key={i} type="button" className="toolbar-btn" title={label as string}>
                <Icon style={{ width: 13, height: 13 }} />
              </button>
            ))}
            <div className="toolbar-divider" />
            {[
              [List, 'List'],
              [Link, 'Link'],
              [Image, 'Image'],
            ].map(([Icon, label], i) => (
              <button key={i} type="button" className="toolbar-btn" title={label as string}>
                <Icon style={{ width: 13, height: 13 }} />
              </button>
            ))}
          </div>

          {/* Body textarea */}
          <textarea
            {...register('body')}
            className="compose-body-textarea"
            placeholder="Type your message here..."
            style={{ minHeight: 'calc(100vh - 400px)' }}
          />
          {errors.body && (
            <div style={{ padding: '0 20px', fontSize: 11, color: '#DC2626' }}>{errors.body.message}</div>
          )}
        </div>

        {/* Footer */}
        <div className="compose-footer">
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E5E7EB', background: 'transparent', color: '#6B7280', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
