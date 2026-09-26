import React, { useState, useEffect } from 'react';
import { PlusCircle, Users, Award, ChevronRight, CheckCircle2, XCircle, ArrowLeft, ShieldCheck, AlertTriangle, Building2, RotateCcw, BadgeCheck } from 'lucide-react';
import apiFetch from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import SkillMatchModal from '../components/SkillMatchModal.jsx';

export function EmployerDashboard({ onNavigatePostJob }) {
  const { t } = useLanguage();

  const [employer, setEmployer] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selected job for applicant viewing
  const [selectedJob, setSelectedJob] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);

  // Status Change Modal State
  const [updatingApp, setUpdatingApp] = useState(null);
  const [newStatus, setNewStatus] = useState('viewed');
  const [statusNote, setStatusNote] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  const [activeMatchModal, setActiveMatchModal] = useState(null);

  const loadEmployerData = async () => {
    setLoading(true);
    try {
      const [empData, jobsData] = await Promise.all([
        apiFetch('/employer/profile'),
        apiFetch('/employer/my-jobs')
      ]);
      setEmployer(empData.employer);
      setJobs(jobsData.jobs || []);
    } catch (err) {
      console.error('Error loading employer dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployerData();
  }, []);

  const handleSelectJob = async (job) => {
    setSelectedJob(job);
    setLoadingApplicants(true);
    try {
      const data = await apiFetch(`/applications/employer/job/${job.id}`);
      setApplicants(data.applicants || []);
    } catch (err) {
      console.error('Error loading applicants:', err);
    } finally {
      setLoadingApplicants(false);
    }
  };

  const handleUpdateStatusSubmit = async (e) => {
    e.preventDefault();
    if (!updatingApp) return;

    setSavingStatus(true);
    try {
      await apiFetch(`/applications/${updatingApp.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ toStatus: newStatus, note: statusNote })
      });

      // Refresh applicants list
      const data = await apiFetch(`/applications/employer/job/${selectedJob.id}`);
      setApplicants(data.applicants || []);

      setUpdatingApp(null);
      setStatusNote('');
    } catch (err) {
      alert(err.message || 'Failed to update application status');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleCloseJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to close this job posting?')) return;
    try {
      await apiFetch(`/jobs/${jobId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'closed' })
      });
      loadEmployerData();
    } catch (err) {
      alert('Failed to close job');
    }
  };

  const handleReopenJob = async (jobId) => {
    try {
      await apiFetch(`/jobs/${jobId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'published' })
      });
      loadEmployerData();
    } catch (err) {
      alert('Failed to re-open job');
    }
  };

  if (loading) {
    return <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading employer portal...</div>;
  }

  // APPLICANT REVIEWER VIEW
  if (selectedJob) {
    return (
      <div style={{ padding: '16px 12px' }}>
        <button className="btn-secondary" onClick={() => setSelectedJob(null)} style={{ width: 'auto', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={16} /> Back to My Postings
        </button>

        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Applicants for "{selectedJob.title}"</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Total Applicants: {applicants.length} • Sorted by SkillMatch %
          </p>
        </div>

        {loadingApplicants ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>Loading applicants...</div>
        ) : applicants.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
            No applications received yet for this opportunity.
          </div>
        ) : (
          applicants.map((app) => {
            const matchSnapshot = app.match_explanation_json;

            return (
              <div key={app.id} className="card" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{app.seeker_name}</h3>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Phone: {app.seeker_phone} • {app.seeker_district || 'Malawi'}
                    </div>
                  </div>

                  {matchSnapshot && (
                    <button
                      className="match-pill match-high"
                      onClick={() => setActiveMatchModal(matchSnapshot)}
                    >
                      <Award size={14} /> {matchSnapshot.matchPercentage}% Match
                    </button>
                  )}
                </div>

                {app.highest_education && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginTop: 4 }}>
                    Education: <strong>{app.highest_education}</strong>
                  </div>
                )}

                {app.cover_note && (
                  <div style={{ background: 'var(--bg-main)', padding: 10, borderRadius: 8, fontSize: '0.85rem', margin: '8px 0', border: '1px solid var(--border)' }}>
                    <strong>Intro Note:</strong> "{app.cover_note}"
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  <span className="badge" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-dark)' }}>
                    Status: {t(`status_${app.current_status}`) || app.current_status}
                  </span>

                  <button
                    className="btn-primary"
                    style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}
                    onClick={() => {
                      setUpdatingApp(app);
                      setNewStatus(app.current_status);
                    }}
                  >
                    Change Status
                  </button>
                </div>
              </div>
            );
          })
        )}

        {/* Status Change Modal */}
        {updatingApp && (
          <div className="modal-overlay" onClick={() => setUpdatingApp(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12 }}>
                Update Application Status: {updatingApp.seeker_name}
              </h3>

              <form onSubmit={handleUpdateStatusSubmit}>
                <div className="form-group">
                  <label className="form-label">New Status</label>
                  <select className="form-select" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                    <option value="viewed">Viewed</option>
                    <option value="shortlisted">Shortlisted</option>
                    <option value="interview">Interview Invitation</option>
                    <option value="offered">Offer Job Position</option>
                    <option value="rejected">Not Selected</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Status Note / Feedback (Optional)</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="e.g. Interview scheduled for Friday 10 AM at Lilongwe office..."
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn-primary" disabled={savingStatus}>
                  {savingStatus ? 'Updating...' : 'Update & Notify Seeker'}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeMatchModal && <SkillMatchModal match={activeMatchModal} onClose={() => setActiveMatchModal(null)} />}
      </div>
    );
  }

  // MAIN EMPLOYER DASHBOARD
  return (
    <div style={{ padding: '16px 12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{t('nav_employer')}</h1>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{employer?.display_name}</div>
        </div>

        <button className="btn-primary" style={{ width: 'auto', padding: '8px 14px' }} onClick={onNavigatePostJob}>
          <PlusCircle size={16} /> Post Opportunity
        </button>
      </div>

      {/* Company Profile Card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Building2 size={22} color="var(--primary)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{employer?.display_name}</h3>
              {employer?.trust_tier === 'tier_1_reviewed' ? (
                <span className="badge badge-verified" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ShieldCheck size={13} /> Verified Employer
                </span>
              ) : (
                <span className="badge badge-type" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={12} color="var(--amber)" /> Pending Verification
                </span>
              )}
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
              <span>District: <strong>{employer?.location_district || 'Lilongwe'}</strong></span>
              {employer?.business_reg_number && <span>Reg No: <strong>{employer.business_reg_number}</strong></span>}
              <span>Active Postings: <strong>{jobs.filter(j => j.status === 'published').length}</strong></span>
            </div>

            {employer?.trust_tier !== 'tier_1_reviewed' && (
              <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={14} />
                Your company is currently unverified. Postings display a standard caution label until administrator review.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* My Postings */}
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12 }}>My Posted Opportunities ({jobs.length})</h2>

      {jobs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: 12 }}>You haven't posted any opportunities yet.</p>
          <button className="btn-primary" onClick={onNavigatePostJob}>
            <PlusCircle size={16} /> Post Your First Opportunity
          </button>
        </div>
      ) : (
        jobs.map((job) => (
          <div key={job.id} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="badge badge-type" style={{ marginBottom: 4 }}>
                  {t(`type_${job.opportunity_type}`) || job.opportunity_type}
                </span>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 4 }}>{job.title}</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Posted: {new Date(job.created_at).toLocaleDateString()} • {job.location_district}
                </div>
              </div>

              <span className={`badge ${job.status === 'published' ? 'badge-verified' : job.status === 'closed' ? 'badge-type' : 'badge-type'}`} style={{ ...(job.status === 'closed' ? { background: '#f1f5f9', color: '#64748b' } : {}) }}>
                {job.status.toUpperCase()}
              </span>
            </div>

            {/* Quality Flag Warning if Flagged */}
            {job.status === 'flagged' && (
              <div className="caution-note" style={{ margin: '8px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={14} color="var(--amber)" />
                Flagged by Quality Checker: {job.quality_flag_reason}
              </div>
            )}

            {/* Applicants Count & Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>
                <Users size={16} />
                {job.applicant_count} Applicant(s)
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {job.status === 'published' && (
                  <button className="btn-secondary" style={{ width: 'auto', padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => handleCloseJob(job.id)}>
                    Close Post
                  </button>
                )}
                {job.status === 'closed' && (
                  <button className="btn-secondary" style={{ width: 'auto', padding: '4px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => handleReopenJob(job.id)}>
                    <RotateCcw size={13} /> Re-open Post
                  </button>
                )}
                <button className="btn-primary" style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handleSelectJob(job)}>
                  View Applicants <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default EmployerDashboard;
