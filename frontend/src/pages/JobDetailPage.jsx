import React, { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Briefcase, DollarSign, Calendar, ShieldCheck, AlertTriangle, Award, Flag, Send, BadgeCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import apiFetch from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import SkillMatchModal from '../components/SkillMatchModal.jsx';

export function JobDetailPage({ jobId, onBack, onSelectCompany, onApplied, onNavigateAuth }) {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [coverNote, setCoverNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState(false);
  const [applyError, setApplyError] = useState('');

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);

  const [activeMatchModal, setActiveMatchModal] = useState(null);

  useEffect(() => {
    async function loadJob() {
      setLoading(true);
      try {
        const data = await apiFetch(`/jobs/${jobId}`);
        setJob(data.job);
      } catch (err) {
        console.error('Error loading job details:', err);
      } finally {
        setLoading(false);
      }
    }
    loadJob();
  }, [jobId]);

  const handleApply = async (e) => {
    e.preventDefault();
    setApplyError('');
    setSubmitting(true);
    try {
      await apiFetch('/applications', {
        method: 'POST',
        body: JSON.stringify({ jobId, coverNote })
      });
      setAppliedSuccess(true);
      setTimeout(() => {
        if (onApplied) onApplied();
      }, 1200);
    } catch (err) {
      setApplyError(err.message || 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReport = async (e) => {
    e.preventDefault();
    if (!reportReason.trim()) return;
    try {
      await apiFetch(`/jobs/${jobId}/report`, {
        method: 'POST',
        body: JSON.stringify({ reason: reportReason })
      });
      setReportSuccess(true);
      setTimeout(() => {
        setReportModalOpen(false);
        setReportSuccess(false);
        setReportReason('');
      }, 1500);
    } catch (err) {
      alert(err.message || 'Failed to submit report');
    }
  };

  if (loading) {
    return <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading opportunity...</div>;
  }

  if (!job) {
    return (
      <div style={{ padding: 16 }}>
        <button className="btn-secondary" onClick={onBack} style={{ width: 'auto', marginBottom: 16 }}>
          <ArrowLeft size={16} style={{ marginRight: 4 }} /> Back to Board
        </button>
        <p>Opportunity not found.</p>
      </div>
    );
  }

  const isVerified = job.employer_trust_tier === 'tier_1_reviewed';
  const isUnverified = job.employer_trust_tier === 'unverified' || job.employer_trust_tier === 'tier_0_phone';

  return (
    <div style={{ padding: '16px 12px' }}>
      <button className="btn-secondary" onClick={onBack} style={{ width: 'auto', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
        <ArrowLeft size={16} /> Back to Board
      </button>

      {/* Main Card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <span className="badge badge-type" style={{ marginBottom: 8 }}>
              <Briefcase size={12} />
              {t(`type_${job.opportunity_type}`) || job.opportunity_type}
            </span>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: 4 }}>{job.title}</h1>
            <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', textAlign: 'left', textDecoration: 'underline' }}
                onClick={() => onSelectCompany && onSelectCompany(job.employer_id)}
              >
                {job.employer_name}
              </button>
              {isVerified && <BadgeCheck size={15} color="#059669" />}
            </div>
          </div>

          {/* SkillMatch Badge */}
          {job.match && (
            <button
              className={`match-pill ${
                job.match.matchPercentage >= 80 ? 'match-high' : job.match.matchPercentage >= 50 ? 'match-medium' : 'match-low'
              }`}
              onClick={() => setActiveMatchModal(job.match)}
            >
              <Award size={16} />
              {job.match.matchPercentage}% Match
            </button>
          )}
        </div>

        {/* Mandatory Caution Label for Unverified Employers */}
        {isUnverified && (
          <div className="caution-note" style={{ marginBottom: 16 }}>
            <AlertTriangle size={16} />
            {t('trust_tier_caution')}
          </div>
        )}

        {isVerified && (
          <div style={{ marginBottom: 16 }}>
            <span className="badge badge-verified">
              <ShieldCheck size={14} /> {t('trust_tier_verified')}
            </span>
          </div>
        )}

        {/* Key Info Metadata */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, fontSize: '0.85rem', background: 'var(--bg-main)', padding: 12, borderRadius: 8 }}>
          <div>
            <strong>Location:</strong> {job.location_district || 'Malawi'} {job.is_remote ? '(Remote)' : ''}
          </div>
          <div>
            <strong>Pay Rate:</strong>{' '}
            {job.pay_amount_min
              ? `MWK ${Number(job.pay_amount_min).toLocaleString()} / ${job.pay_period || 'month'}`
              : 'Negotiable'}
          </div>
          {job.application_deadline && (
            <div style={{ gridColumn: 'span 2' }}>
              <strong>Application Deadline:</strong> {new Date(job.application_deadline).toLocaleDateString()}
              {new Date(job.application_deadline) < new Date() && (
                <span style={{ color: 'var(--danger)', fontWeight: 700, marginLeft: 6 }}>(Closed)</span>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>Description</h3>
          <p style={{ fontSize: '0.95rem', whiteSpace: 'pre-line', color: 'var(--text-main)' }}>{job.description}</p>
        </div>

        {/* Required & Nice-to-Have Skills */}
        {job.skills && job.skills.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8 }}>Skills Required & Recommended</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {job.skills.map((s) => (
                <span
                  key={s.skill_id}
                  className="badge"
                  style={{
                    backgroundColor: s.is_required ? 'var(--primary-light)' : 'var(--bg-main)',
                    color: s.is_required ? 'var(--primary-dark)' : 'var(--text-muted)',
                    border: '1px solid var(--border)'
                  }}
                >
                  {s.skill_name} {s.is_required ? '(Required)' : '(Nice-to-have)'}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action Button & Apply Form */}
        {job.application_deadline && new Date(job.application_deadline) < new Date() ? (
          <div style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)', padding: 14, borderRadius: 8, textAlign: 'center', fontWeight: 700, marginTop: 16 }}>
            This opportunity is closed and no longer accepting applications.
          </div>
        ) : user?.role === 'job_seeker' ? (
          appliedSuccess || job.has_applied ? (
            <div style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: 16, borderRadius: 8, textAlign: 'center', fontWeight: 600, marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '1.05rem', fontWeight: 700, marginBottom: 4 }}>
                <CheckCircle2 size={18} color="#059669" /> Application Submitted!
              </div>
              <div style={{ fontSize: '0.85rem', color: '#047857' }}>
                You have applied to this opportunity. Track its progress in your Applications tab.
              </div>
            </div>
          ) : (
            <form onSubmit={handleApply} style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              {applyError && (
                <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '10px 12px', borderRadius: 8, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <AlertCircle size={16} />
                  <span>{applyError}</span>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">{t('cover_note_label')}</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder={t('cover_note_placeholder')}
                  value={coverNote}
                  onChange={(e) => setCoverNote(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={submitting}>
                <Send size={16} /> {submitting ? 'Submitting...' : t('apply_now')}
              </button>
            </form>
          )
        ) : !user ? (
          <div style={{ textAlign: 'center', padding: 18, backgroundColor: 'var(--surface-variant, #f8fafc)', borderRadius: 10, marginTop: 16, border: '1px dashed var(--border)' }}>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Sign in with your phone or create a job seeker profile to apply.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={onNavigateAuth}
              style={{ width: '100%', maxWidth: 260, margin: '0 auto', fontSize: '0.9rem' }}
            >
              Sign In as Job Seeker to Apply
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 14, backgroundColor: 'var(--surface-variant, #f8fafc)', borderRadius: 8, marginTop: 16, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Logged in as Employer ({user.email}). Applications are only submitted from Job Seeker accounts.
          </div>
        )}

        {/* Report Button */}
        {user && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button
              onClick={() => setReportModalOpen(true)}
              style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <Flag size={14} /> Report suspicious opportunity
            </button>
          </div>
        )}
      </div>

      {/* SkillMatch Modal */}
      {activeMatchModal && <SkillMatchModal match={activeMatchModal} onClose={() => setActiveMatchModal(null)} />}

      {/* Report Modal */}
      {reportModalOpen && (
        <div className="modal-overlay" onClick={() => setReportModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12 }}>Report Opportunity</h3>
            {reportSuccess ? (
              <div style={{ color: 'var(--primary)', fontWeight: 700 }}>Report submitted to moderators. Thank you.</div>
            ) : (
              <form onSubmit={handleReport}>
                <div className="form-group">
                  <label className="form-label">Reason for report</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Describe scam, upfront payment demand, or deceptive behavior..."
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn-primary" style={{ backgroundColor: 'var(--danger)' }}>
                  Submit Report
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default JobDetailPage;
