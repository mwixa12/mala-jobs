import React, { useState, useEffect } from 'react';
import { FileText, Clock, ChevronDown, ChevronUp, Award, AlertCircle } from 'lucide-react';
import apiFetch from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import SkillMatchModal from '../components/SkillMatchModal.jsx';

export function ApplicationsPage() {
  const { t } = useLanguage();

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedAppId, setExpandedAppId] = useState(null);
  const [activeMatchModal, setActiveMatchModal] = useState(null);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/applications/me');
      setApplications(data.applications || []);
    } catch (err) {
      console.error('Error fetching applications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleWithdraw = async (appId) => {
    if (!window.confirm('Are you sure you want to withdraw this application?')) return;
    try {
      await apiFetch(`/applications/${appId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ toStatus: 'withdrawn', note: 'Withdrawn by seeker' })
      });
      fetchApplications();
    } catch (err) {
      alert(err.message || 'Failed to withdraw application');
    }
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'offered': return { bg: '#d1fae5', color: '#065f46' };
      case 'interview': return { bg: '#dbeafe', color: '#1e40af' };
      case 'shortlisted': return { bg: '#fef3c7', color: '#92400e' };
      case 'viewed': return { bg: '#f1f5f9', color: '#334155' };
      case 'rejected': return { bg: 'var(--danger-light)', color: 'var(--danger)' };
      case 'withdrawn': return { bg: '#f1f5f9', color: '#64748b' };
      default: return { bg: 'var(--primary-light)', color: 'var(--primary-dark)' };
    }
  };

  if (loading) {
    return <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading application history...</div>;
  }

  return (
    <div style={{ padding: '16px 12px' }}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 16 }}>{t('nav_applications')}</h1>

      {applications.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <FileText size={32} color="var(--text-muted)" style={{ marginBottom: 8 }} />
          <p style={{ color: 'var(--text-muted)' }}>You haven't submitted any applications yet.</p>
        </div>
      ) : (
        applications.map((app) => {
          const badgeStyle = getStatusBadgeStyle(app.current_status);
          const isExpanded = expandedAppId === app.id;
          const matchSnapshot = app.match_explanation_json || null;

          return (
            <div key={app.id} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{app.job_title}</h3>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>{app.employer_name}</div>
                </div>

                <span className="badge" style={{ backgroundColor: badgeStyle.bg, color: badgeStyle.color }}>
                  {t(`status_${app.current_status}`) || app.current_status}
                </span>
              </div>

              {/* Match Snapshot */}
              {matchSnapshot && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0', padding: 8, background: 'var(--bg-main)', borderRadius: 8 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>SkillMatch at Application:</span>
                  <button
                    className="match-pill match-high"
                    style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                    onClick={() => setActiveMatchModal(matchSnapshot)}
                  >
                    <Award size={12} /> {matchSnapshot.matchPercentage}%
                  </button>
                </div>
              )}

              {/* Toggle Timeline */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Submitted: {new Date(app.created_at).toLocaleDateString()}
                </span>

                <button
                  onClick={() => setExpandedAppId(isExpanded ? null : app.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  {isExpanded ? 'Hide History' : 'Status History'} {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {/* Timeline History */}
              {isExpanded && (
                <div className="timeline">
                  {app.history && app.history.map((h) => (
                    <div key={h.id} className="timeline-item">
                      <div style={{ fontWeight: 600 }}>
                        {t(`status_${h.to_status}`) || h.to_status}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(h.changed_at).toLocaleString()} {h.note ? `• "${h.note}"` : ''}
                      </div>
                    </div>
                  ))}

                  {app.current_status !== 'withdrawn' && app.current_status !== 'rejected' && (
                    <div style={{ marginTop: 12 }}>
                      <button
                        onClick={() => handleWithdraw(app.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Withdraw Application
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {activeMatchModal && <SkillMatchModal match={activeMatchModal} onClose={() => setActiveMatchModal(null)} />}
    </div>
  );
}

export default ApplicationsPage;
