import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, CheckCircle2, XCircle, History, Edit3, Send,
  BadgeCheck, BarChart2, Briefcase, Flag, FileWarning,
  PlusSquare, Building2, AlertTriangle, Users, TrendingUp,
  Layers, Check, X
} from 'lucide-react';
import apiFetch from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const DISTRICTS = ['Lilongwe','Blantyre','Mzuzu','Zomba','Salima','Kasungu','Dedza','Mangochi','Karonga','Nkhotakota'];
const OPP_TYPES = [
  { value: 'formal_job', label: 'Formal Job' },
  { value: 'internship', label: 'Internship' },
  { value: 'apprenticeship', label: 'Apprenticeship' },
  { value: 'gig', label: 'Gig Work' },
  { value: 'informal', label: 'Informal Contract' },
  { value: 'self_employment_resource', label: 'Self-Employment Resource' }
];

function StatCard({ icon: Icon, label, value, color, accent }) {
  const c = color || 'var(--primary)';
  const a = accent || 'var(--primary-light)';
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ background: a, borderRadius: 10, padding: 10, flexShrink: 0 }}>
        <Icon size={20} color={c} />
      </div>
      <div>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: c, lineHeight: 1 }}>{value ?? 0}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

function AdminSidebar({ activeTab, setActiveTab, counts }) {
  const items = [
    { id: 'stats', label: 'Dashboard', icon: BarChart2 },
    { id: 'post-job', label: 'Post New Job', icon: PlusSquare },
    { id: 'flagged', label: 'Flagged Jobs', icon: Flag, badge: counts.flagged },
    { id: 'companies', label: 'Company Verification', icon: Building2 },
    { id: 'reports', label: 'User Reports', icon: FileWarning, badge: counts.reports },
    { id: 'audit', label: 'Audit Trail', icon: History }
  ];
  return (
    <aside style={{ width: 220, flexShrink: 0, background: 'var(--bg-card)', borderRight: '1px solid var(--border)', padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 'calc(100vh - 56px)' }}>
      <div style={{ padding: '6px 10px 14px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--primary)' }}>Admin Back-Office</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>System Administration</div>
      </div>
      {items.map(({ id, label, icon: Icon, badge }) => (
        <button key={id} onClick={() => setActiveTab(id)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', background: activeTab === id ? 'var(--primary)' : 'transparent', color: activeTab === id ? '#fff' : 'var(--text-main)', fontWeight: activeTab === id ? 700 : 500, fontSize: '0.85rem' }}>
          <Icon size={17} />
          <span style={{ flex: 1 }}>{label}</span>
          {badge > 0 && (
            <span style={{ background: activeTab === id ? 'rgba(255,255,255,0.25)' : 'var(--danger)', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 800 }}>{badge}</span>
          )}
        </button>
      ))}
    </aside>
  );
}

export function AdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [flaggedJobs, setFlaggedJobs] = useState([]);
  const [employers, setEmployers] = useState([]);
  const [reports, setReports] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editingJob, setEditingJob] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  const [postForm, setPostForm] = useState({ employerId: '', title: '', description: '', opportunityType: 'formal_job', locationDistrict: 'Lilongwe', payAmountMin: '', payAmountMax: '', payPeriod: 'monthly', applicationDeadline: '', publishImmediately: true });
  const [postLoading, setPostLoading] = useState(false);
  const [postMsg, setPostMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, f, e, r, l] = await Promise.all([
        apiFetch('/admin/stats'),
        apiFetch('/admin/flagged-jobs'),
        apiFetch('/admin/employers'),
        apiFetch('/admin/reports'),
        apiFetch('/admin/audit-logs')
      ]);
      setStats(s.stats);
      setFlaggedJobs(f.flaggedJobs || []);
      setEmployers(e.employers || []);
      setReports(r.reports || []);
      setAuditLogs(l.auditLogs || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (user?.role === 'admin') loadData(); }, [user]);

  const handleVerifyBadge = async (empId, tier) => {
    const next = tier === 'tier_1_reviewed' ? 'unverified' : 'tier_1_reviewed';
    try { await apiFetch(`/admin/employers/${empId}/trust-tier`, { method: 'POST', body: JSON.stringify({ trustTier: next }) }); loadData(); }
    catch { alert('Failed to update verification'); }
  };

  const handleReviewJob = async (jobId, action) => {
    const note = window.prompt(`Moderation note for ${action}:`, '');
    if (note === null) return;
    try { await apiFetch(`/admin/jobs/${jobId}/review`, { method: 'POST', body: JSON.stringify({ action, moderationNote: note }) }); loadData(); }
    catch { alert('Failed to process review'); }
  };

  const handleOpenEdit = (job) => {
    setEditingJob(job);
    setEditForm({ title: job.title, description: job.description, opportunityType: job.opportunity_type, locationDistrict: job.location_district || 'Lilongwe', payAmountMin: job.pay_amount_min || '', payAmountMax: job.pay_amount_max || '' });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSavingEdit(true);
    try { await apiFetch(`/admin/jobs/${editingJob.id}`, { method: 'PUT', body: JSON.stringify({ ...editForm, status: 'published' }) }); setEditingJob(null); loadData(); }
    catch (err) { alert(err.message || 'Failed to save'); }
    finally { setSavingEdit(false); }
  };

  const handleResolveReport = async (id) => {
    const note = window.prompt('Resolution note:', 'Reviewed and resolved.');
    if (note === null) return;
    try { await apiFetch(`/admin/reports/${id}/resolve`, { method: 'POST', body: JSON.stringify({ actionNote: note }) }); loadData(); }
    catch { alert('Failed to resolve'); }
  };

  const handlePostJob = async (e) => {
    e.preventDefault();
    setPostLoading(true);
    setPostMsg('');
    try {
      await apiFetch('/admin/jobs', { method: 'POST', body: JSON.stringify({ ...postForm, payAmountMin: postForm.payAmountMin ? parseFloat(postForm.payAmountMin) : null, payAmountMax: postForm.payAmountMax ? parseFloat(postForm.payAmountMax) : null, applicationDeadline: postForm.applicationDeadline || null }) });
      setPostMsg('Job posted successfully!');
      setPostForm(p => ({ ...p, title: '', description: '', payAmountMin: '', payAmountMax: '', applicationDeadline: '' }));
      loadData();
    } catch (err) { setPostMsg(err.message || 'Failed to post'); }
    finally { setPostLoading(false); }
  };

  if (user?.role !== 'admin') {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <ShieldAlert size={40} color="var(--danger)" style={{ marginBottom: 12 }} />
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Admin Access Required</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>Sign in with an administrator account to access the back-office.</p>
      </div>
    );
  }

  const counts = { flagged: flaggedJobs.length, reports: reports.filter(r => !r.resolved).length };

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)' }}>
      <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} counts={counts} />

      <main style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Loading admin data...</div>
        ) : (
          <>
            {activeTab === 'stats' && (
              <div>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 4 }}>Platform Dashboard</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>Real-time overview of the MalaJobs platform.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
                  <StatCard icon={Users} label="Registered Job Seekers" value={stats?.totalSeekers} />
                  <StatCard icon={Building2} label="Registered Companies" value={stats?.totalEmployers} color="var(--secondary)" accent="var(--secondary-light)" />
                  <StatCard icon={Briefcase} label="Active Job Listings" value={stats?.activeJobs} color="var(--success)" accent="var(--success-light)" />
                  <StatCard icon={TrendingUp} label="Applications This Week" value={stats?.applicationsThisWeek} color="var(--amber)" accent="var(--amber-light)" />
                  <StatCard icon={Flag} label="Pending Flagged Posts" value={stats?.pendingFlaggedJobs} color="var(--danger)" accent="var(--danger-light)" />
                  <StatCard icon={FileWarning} label="Open User Reports" value={stats?.openReports} color="var(--danger)" accent="var(--danger-light)" />
                </div>
                <div className="card" style={{ background: 'var(--primary-light)', borderColor: 'var(--primary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Layers size={18} color="var(--primary)" />
                    <strong style={{ color: 'var(--primary)' }}>Quick Actions</strong>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                    <button className="btn-primary" style={{ width: 'auto', padding: '8px 14px', fontSize: '0.85rem' }} onClick={() => setActiveTab('post-job')}>
                      <PlusSquare size={14} /> Post New Job
                    </button>
                    <button className="btn-secondary" style={{ width: 'auto', padding: '8px 14px', fontSize: '0.85rem' }} onClick={() => setActiveTab('flagged')}>
                      <Flag size={14} /> Review Flagged ({counts.flagged})
                    </button>
                    <button className="btn-secondary" style={{ width: 'auto', padding: '8px 14px', fontSize: '0.85rem' }} onClick={() => setActiveTab('companies')}>
                      <BadgeCheck size={14} /> Verify Companies
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'post-job' && (
              <div>
                <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 4 }}>Post New Job</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>Create a job on behalf of a registered company.</p>
                {postMsg && (
                  <div style={{ padding: 12, borderRadius: 8, marginBottom: 16, fontSize: '0.85rem', background: postMsg.includes('success') ? 'var(--success-light)' : 'var(--danger-light)', color: postMsg.includes('success') ? 'var(--success)' : 'var(--danger)', border: `1px solid ${postMsg.includes('success') ? 'var(--success)' : 'var(--danger)'}` }}>
                    {postMsg}
                  </div>
                )}
                <form onSubmit={handlePostJob} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Select Company *</label>
                    <select className="form-select" value={postForm.employerId} onChange={e => setPostForm(p => ({ ...p, employerId: e.target.value }))} required>
                      <option value="">— Choose a registered company —</option>
                      {employers.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.display_name} {emp.trust_tier === 'tier_1_reviewed' ? '(Verified)' : '(Unverified)'}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Job Title *</label>
                    <input className="form-input" type="text" required placeholder="e.g. Solar Technician" value={postForm.title} onChange={e => setPostForm(p => ({ ...p, title: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Opportunity Type *</label>
                    <select className="form-select" value={postForm.opportunityType} onChange={e => setPostForm(p => ({ ...p, opportunityType: e.target.value }))}>
                      {OPP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Full Description & Qualifications *</label>
                    <textarea className="form-textarea" rows={5} required placeholder="Role description, responsibilities, required qualifications..." value={postForm.description} onChange={e => setPostForm(p => ({ ...p, description: e.target.value }))} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">District</label>
                      <select className="form-select" value={postForm.locationDistrict} onChange={e => setPostForm(p => ({ ...p, locationDistrict: e.target.value }))}>
                        {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Pay Period</label>
                      <select className="form-select" value={postForm.payPeriod} onChange={e => setPostForm(p => ({ ...p, payPeriod: e.target.value }))}>
                        <option value="monthly">Monthly</option>
                        <option value="weekly">Weekly</option>
                        <option value="daily">Daily</option>
                        <option value="project">Per Project</option>
                        <option value="one-time">One-time</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Min Pay (MWK)</label>
                      <input className="form-input" type="number" placeholder="e.g. 150000" value={postForm.payAmountMin} onChange={e => setPostForm(p => ({ ...p, payAmountMin: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Max Pay (MWK)</label>
                      <input className="form-input" type="number" placeholder="e.g. 250000" value={postForm.payAmountMax} onChange={e => setPostForm(p => ({ ...p, payAmountMax: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Application Deadline</label>
                    <input className="form-input" type="date" value={postForm.applicationDeadline} onChange={e => setPostForm(p => ({ ...p, applicationDeadline: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" id="publishNow" checked={postForm.publishImmediately} onChange={e => setPostForm(p => ({ ...p, publishImmediately: e.target.checked }))} />
                    <label htmlFor="publishNow" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Publish immediately (bypass quality checker)</label>
                  </div>
                  <button type="submit" className="btn-primary" disabled={postLoading || !postForm.employerId}>
                    <Send size={16} /> {postLoading ? 'Posting...' : 'Post Job'}
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'flagged' && (
              <div>
                <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 16 }}>
                  Flagged Job Review
                  {flaggedJobs.length > 0 && <span style={{ marginLeft: 10, fontSize: '0.85rem', background: 'var(--danger)', color: '#fff', borderRadius: 999, padding: '2px 10px' }}>{flaggedJobs.length}</span>}
                </h1>
                {flaggedJobs.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
                    <CheckCircle2 size={32} color="var(--success)" style={{ marginBottom: 8 }} />
                    <div style={{ fontWeight: 600 }}>No flagged jobs. All clear.</div>
                  </div>
                ) : (
                  flaggedJobs.map(job => (
                    <div key={job.id} className="card" style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{job.title}</h3>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{job.employer_name} · {job.location_district}</div>
                        </div>
                        <span className="badge" style={{ backgroundColor: 'var(--amber-light)', color: 'var(--amber)', flexShrink: 0 }}>FLAGGED</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '10px 0', background: 'var(--danger-light)', borderRadius: 8, padding: '8px 12px', border: '1px solid var(--danger)' }}>
                        <AlertTriangle size={14} color="var(--danger)" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span style={{ fontSize: '0.82rem', color: 'var(--danger)' }}>Quality Checker: {job.quality_flag_reason}</span>
                      </div>
                      <div style={{ fontSize: '0.84rem', background: 'var(--bg-main)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 12 }}>
                        {job.description?.slice(0, 200)}{job.description?.length > 200 ? '...' : ''}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn-secondary" style={{ flex: 1, padding: 8, fontSize: '0.82rem' }} onClick={() => handleOpenEdit(job)}><Edit3 size={14} /> Edit Details</button>
                        <button className="btn-primary" style={{ flex: 1, padding: 8, fontSize: '0.82rem' }} onClick={() => handleReviewJob(job.id, 'approve')}><Check size={14} /> Approve</button>
                        <button style={{ padding: '8px 14px', fontSize: '0.82rem', border: '1px solid var(--danger)', background: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 8, cursor: 'pointer' }} onClick={() => handleReviewJob(job.id, 'reject')}><X size={14} /> Reject</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'companies' && (
              <div>
                <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 16 }}>Company Verification</h1>
                {employers.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>No companies registered yet.</div>
                ) : (
                  employers.map(emp => {
                    const isV = emp.trust_tier === 'tier_1_reviewed';
                    return (
                      <div key={emp.id} className="card" style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{emp.display_name}</h3>
                              {isV && <span className="badge badge-verified" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><BadgeCheck size={12} /> Verified</span>}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                              <span>District: {emp.location_district || 'N/A'}</span>
                              <span>Email: {emp.account_email || 'N/A'}</span>
                              <span>Reg No: {emp.business_reg_number || 'Not provided'}</span>
                              <span>Jobs Posted: <strong>{emp.job_count}</strong></span>
                            </div>
                          </div>
                          <span className={`badge ${isV ? 'badge-verified' : 'badge-type'}`}>{isV ? 'TIER 1 VERIFIED' : 'UNVERIFIED'}</span>
                        </div>
                        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                          <button className={isV ? 'btn-secondary' : 'btn-primary'} style={{ width: 'auto', padding: '8px 16px', fontSize: '0.82rem', ...(isV ? { color: 'var(--danger)', borderColor: 'var(--danger)' } : {}) }} onClick={() => handleVerifyBadge(emp.id, emp.trust_tier)}>
                            <BadgeCheck size={14} /> {isV ? 'Revoke Verification Badge' : 'Grant Verification Badge'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'reports' && (
              <div>
                <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 16 }}>User Reports</h1>
                {reports.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>No reports logged.</div>
                ) : (
                  reports.map(r => (
                    <div key={r.id} className="card" style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Report: {r.job_title || r.employer_name || 'Platform Item'}</h3>
                        <span className={`badge ${r.resolved ? 'badge-verified' : 'badge-type'}`}>{r.resolved ? 'RESOLVED' : 'OPEN'}</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', margin: '8px 0' }}><strong>Reason:</strong> "{r.reason}"</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Reported by: {r.reporter_phone} · {new Date(r.created_at).toLocaleString()}</div>
                      {!r.resolved && (
                        <button className="btn-primary" style={{ marginTop: 12, width: 'auto', padding: '6px 14px', fontSize: '0.82rem' }} onClick={() => handleResolveReport(r.id)}>
                          <CheckCircle2 size={14} /> Mark Resolved
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'audit' && (
              <div>
                <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 16 }}>System Audit Trail</h1>
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '8px 16px', background: 'var(--bg-main)', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr', gap: 8 }}>
                    <span>Action</span><span>Target</span><span>Actor</span><span>When</span>
                  </div>
                  {auditLogs.map(log => (
                    <div key={log.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{log.action}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{log.target_type} {log.target_id ? `#${String(log.target_id).slice(0, 8)}` : ''}</span>
                      <span>{log.actor_email || log.actor_phone || 'System'}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {editingJob && (
        <div className="modal-overlay" onClick={() => setEditingJob(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Edit & Publish Job</h3>
              <button onClick={() => setEditingJob(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><XCircle size={22} /></button>
            </div>
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Job Title</label>
                <input className="form-input" type="text" required value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Opportunity Type</label>
                <select className="form-select" value={editForm.opportunityType} onChange={e => setEditForm(p => ({ ...p, opportunityType: e.target.value }))}>
                  {OPP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Description & Qualifications</label>
                <textarea className="form-textarea" rows={5} required value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Min Pay (MWK)</label>
                  <input className="form-input" type="number" value={editForm.payAmountMin} onChange={e => setEditForm(p => ({ ...p, payAmountMin: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Pay (MWK)</label>
                  <input className="form-input" type="number" value={editForm.payAmountMax} onChange={e => setEditForm(p => ({ ...p, payAmountMax: e.target.value }))} />
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={savingEdit}>
                <Send size={15} /> {savingEdit ? 'Saving...' : 'Save Edits & Publish'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;
