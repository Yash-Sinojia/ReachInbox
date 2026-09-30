'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw, Search, X, Plus, Trash2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { Suspense } from 'react';

import Sidebar from '@/components/Sidebar';
import EmailList from '@/components/EmailTable';
import ComposeModal from '@/components/ComposeModal';
import { useAuth } from '@/hooks/useAuth';
import { emailsApi, sendersApi, slackApi } from '@/lib/api';
import { EmailJob, EmailStats, Sender, SlackStatus } from '@/types';

type Tab = 'scheduled' | 'sent';

function DashboardContent() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<Tab>('scheduled');
  const [scheduledEmails, setScheduledEmails] = useState<EmailJob[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailJob[]>([]);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [slackStatus, setSlackStatus] = useState<SlackStatus>({ connected: false, team_id: null });
  const [loadingEmails, setLoadingEmails] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EmailJob[] | null>(null);
  const [creatingSender, setCreatingSender] = useState(false);
  const [showSenders, setShowSenders] = useState(false);

  useEffect(() => {
    const slack = searchParams.get('slack');
    if (slack === 'connected') {
      toast.success('Slack connected!');
      router.replace('/dashboard');
    } else if (slack === 'error') {
      toast.error('Slack connection failed.');
      router.replace('/dashboard');
    }
  }, [searchParams, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoadingEmails(true);
    setLoadingStats(true);
    try {
      const [scheduled, sent, statsData, sendersData, slackData] = await Promise.allSettled([
        emailsApi.getScheduled(),
        emailsApi.getSent(),
        emailsApi.getStats(),
        sendersApi.list(),
        slackApi.getStatus(),
      ]);

      // If core email endpoints both failed, likely the backend is down
      if (scheduled.status === 'rejected' && sent.status === 'rejected') {
        const err = (scheduled as PromiseRejectedResult).reason;
        const isNetwork = !err?.response; // no response = network/CORS error
        if (isNetwork) {
          toast.error('Cannot reach backend. Is the server running on port 3001?');
        } else {
          toast.error(`Server error: ${err?.response?.data?.error || err?.message || 'Unknown error'}`);
        }
      }

      if (scheduled.status === 'fulfilled') setScheduledEmails(scheduled.value.emails);
      if (sent.status === 'fulfilled') setSentEmails(sent.value.emails);
      if (statsData.status === 'fulfilled') setStats(statsData.value);
      if (sendersData.status === 'fulfilled') setSenders(sendersData.value);
      if (slackData.status === 'fulfilled') setSlackStatus(slackData.value);

      // Log individual failures for debugging
      [scheduled, sent, statsData, sendersData, slackData].forEach((r, i) => {
        if (r.status === 'rejected') {
          console.warn(`API call ${i} failed:`, (r as PromiseRejectedResult).reason?.message);
        }
      });
    } catch (err) {
      console.error('Unexpected fetchData error:', err);
    } finally {
      setLoadingEmails(false);
      setLoadingStats(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    toast.success('Refreshed');
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults(null); return; }
    try {
      const results = await emailsApi.search(q, activeTab === 'scheduled' ? 'scheduled' : 'sent');
      setSearchResults(results.hits);
    } catch {
      toast.error('Search failed');
    }
  };

  const handleCreateSender = async () => {
    setCreatingSender(true);
    try {
      const newSender = await sendersApi.create();
      setSenders(prev => [newSender, ...prev]);
      toast.success(`Created: ${newSender.email}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to create sender');
    } finally {
      setCreatingSender(false);
    }
  };

  const handleDeleteSender = async (id: string) => {
    if (!confirm('Delete this sender?')) return;
    try {
      await sendersApi.delete(id);
      setSenders(prev => prev.filter(s => s.id !== id));
      toast.success('Sender deleted');
      fetchData();
    } catch {
      toast.error('Failed to delete sender');
    }
  };

  const handleSlackConnect = () => {
    if (slackStatus.connected) {
      if (confirm('Disconnect Slack?')) {
        slackApi.disconnect().then(() => {
          setSlackStatus({ connected: false, team_id: null });
          toast.success('Slack disconnected');
        });
      }
    } else {
      window.location.href = slackApi.getConnectUrl();
    }
  };

  const displayedEmails = searchResults !== null
    ? searchResults
    : activeTab === 'scheduled'
    ? scheduledEmails
    : sentEmails;

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F5F7' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 18, height: 18, border: '2px solid #E5E7EB', borderTopColor: '#00A859', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 13, color: '#6B7280' }}>Loading...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <Sidebar
        user={user}
        onLogout={logout}
        activeTab={activeTab}
        onTabChange={(tab) => { setActiveTab(tab); setSearchResults(null); setSearchQuery(''); }}
        scheduledCount={stats ? Number(stats.scheduled) : 0}
        sentCount={stats ? Number(stats.sent) : 0}
        onCompose={() => setComposeOpen(true)}
        slackConnected={slackStatus.connected}
        onSlackConnect={handleSlackConnect}
      />

      {/* Main area */}
      <div className="main-content">

        {/* Top bar with search */}
        <div className="main-topbar">
          <div className="search-input-wrap">
            <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#9CA3AF' }} />
            <input
              type="text"
              placeholder={`Search ${activeTab} emails...`}
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              id="email-search"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSearchResults(null); }}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', padding: 2, color: '#9CA3AF' }}
              >
                <X style={{ width: 12, height: 12 }} />
              </button>
            )}
          </div>

          {/* Queue link */}
          <a
            href="http://localhost:3001/admin/queues"
            target="_blank"
            rel="noopener noreferrer"
            className="topbar-icon-btn"
            title="BullMQ Dashboard"
            style={{ textDecoration: 'none' }}
          >
            <ExternalLink style={{ width: 14, height: 14 }} />
          </a>

          {/* Refresh */}
          <button
            className="topbar-icon-btn"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh"
          >
            <RefreshCw style={{ width: 14, height: 14 }} className={refreshing ? 'animate-spin' : ''} />
          </button>

          {/* Senders toggle */}
          <button
            className="topbar-icon-btn"
            onClick={() => setShowSenders(v => !v)}
            title="Manage Senders"
            style={{ fontSize: 11, fontWeight: 600, color: showSenders ? '#00A859' : '#6B7280', gap: 4, padding: '7px 10px', minWidth: 'auto', width: 'auto', whiteSpace: 'nowrap' }}
          >
            Senders {senders.length > 0 ? `(${senders.length})` : ''}
          </button>
        </div>

        {/* Stats bar */}
        <div className="stats-bar">
          {loadingStats ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="stat-item">
                <div className="shimmer" style={{ width: 40, height: 28, borderRadius: 4, marginBottom: 6 }} />
                <div className="shimmer" style={{ width: 70, height: 11, borderRadius: 4 }} />
              </div>
            ))
          ) : [
            { label: 'TOTAL', value: stats ? Number(stats.total) : 0 },
            { label: 'SCHEDULED', value: stats ? Number(stats.scheduled) : 0 },
            { label: 'SENT', value: stats ? Number(stats.sent) : 0 },
            { label: 'FAILED', value: stats ? Number(stats.failed) : 0 },
            { label: 'DELAYED', value: stats ? Number(stats.delayed) : 0 },
          ].map(({ label, value }) => (
            <div key={label} className="stat-item">
              <div className="stat-value">{value.toLocaleString()}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>

        {/* Senders panel (collapsible) */}
        {showSenders && (
          <div className="senders-section fade-in">
            <div className="senders-header">
              <span className="senders-title">Sender Accounts</span>
              <button
                className="add-sender-btn"
                onClick={handleCreateSender}
                disabled={creatingSender}
              >
                {creatingSender ? (
                  <div style={{ width: 10, height: 10, border: '1.5px solid #00A859', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                ) : (
                  <Plus style={{ width: 10, height: 10 }} />
                )}
                {creatingSender ? 'Creating...' : 'New Sender'}
              </button>
            </div>

            {senders.length === 0 ? (
              <div style={{ fontSize: 12, color: '#9CA3AF', padding: '8px 0' }}>
                No senders yet. Create one to start scheduling emails.
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {senders.map(sender => (
                  <div key={sender.id} className="sender-pill">
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#00A859', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white' }}>
                      {sender.email.charAt(0).toUpperCase()}
                    </div>
                    {sender.email}
                    <button
                      className="sender-pill-delete"
                      onClick={() => handleDeleteSender(sender.id)}
                      title="Delete"
                    >
                      <X style={{ width: 10, height: 10 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Email list */}
        <EmailList
          emails={displayedEmails}
          loading={loadingEmails}
          type={activeTab}
          emptyMessage={searchQuery ? `No results for "${searchQuery}"` : undefined}
        />
      </div>

      {/* Compose Modal */}
      <ComposeModal
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        senders={senders}
        onSuccess={fetchData}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F5F7' }}>
        <div style={{ width: 18, height: 18, border: '2px solid #E5E7EB', borderTopColor: '#00A859', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
