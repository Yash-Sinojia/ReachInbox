'use client';

import { User } from '@/types';
import { Clock, Send, Plus, ChevronDown } from 'lucide-react';

interface SidebarProps {
  user: User;
  onLogout: () => void;
  activeTab: 'scheduled' | 'sent';
  onTabChange: (tab: 'scheduled' | 'sent') => void;
  scheduledCount: number;
  sentCount: number;
  onCompose: () => void;
  slackConnected: boolean;
  onSlackConnect: () => void;
}

export default function Sidebar({
  user,
  onLogout,
  activeTab,
  onTabChange,
  scheduledCount,
  sentCount,
  onCompose,
  slackConnected,
  onSlackConnect,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">ReachInbox</div>

      {/* User account */}
      <div className="sidebar-user" title={user.email}>
        <div className="sidebar-avatar" style={{ padding: 0, overflow: 'hidden', background: '#f3f4f6' }}>
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={(e) => {
                // Fallback to letter initial if avatar URL fails
                const el = e.currentTarget;
                el.style.display = 'none';
                (el.parentElement as HTMLElement).textContent = user.name.charAt(0).toUpperCase();
              }}
            />
          ) : (
            user.name.charAt(0).toUpperCase()
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.name}
          </div>
          <div style={{ fontSize: 10, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.email}
          </div>
        </div>
        <ChevronDown style={{ width: 12, height: 12, color: '#9CA3AF', flexShrink: 0 }} />
      </div>

      {/* Compose button */}
      <button className="sidebar-compose-btn" onClick={onCompose} id="compose-btn">
        <Plus style={{ width: 14, height: 14 }} />
        Compose
      </button>

      {/* Nav section */}
      <div className="sidebar-section-label">Core</div>

      <button
        className={`sidebar-nav-item ${activeTab === 'scheduled' ? 'active' : ''}`}
        onClick={() => onTabChange('scheduled')}
        id="nav-scheduled"
      >
        <Clock style={{ width: 14, height: 14, flexShrink: 0 }} />
        Scheduled
        <span className="sidebar-nav-badge">{scheduledCount}</span>
      </button>

      <button
        className={`sidebar-nav-item ${activeTab === 'sent' ? 'active' : ''}`}
        onClick={() => onTabChange('sent')}
        id="nav-sent"
      >
        <Send style={{ width: 14, height: 14, flexShrink: 0 }} />
        Sent
        <span className="sidebar-nav-badge">{sentCount}</span>
      </button>

      {/* Divider */}
      <div style={{ flex: 1 }} />

      {/* Slack + logout at bottom */}
      <div style={{ padding: '8px 12px 12px', borderTop: '1px solid #F3F4F6' }}>
        <button
          onClick={onSlackConnect}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 10px',
            borderRadius: 8,
            border: '1px solid #E5E7EB',
            background: 'transparent',
            color: slackConnected ? '#00A859' : '#6B7280',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 6,
            transition: 'all 0.15s',
          }}
        >
          <svg style={{ width: 12, height: 12 }} viewBox="0 0 24 24" fill="currentColor">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
          </svg>
          {slackConnected ? 'Slack Connected' : 'Connect Slack'}
        </button>

        <button
          onClick={onLogout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 10px',
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            color: '#9CA3AF',
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
