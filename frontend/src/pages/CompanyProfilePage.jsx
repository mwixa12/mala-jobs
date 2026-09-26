import React, { useState, useEffect } from 'react';
import { ArrowLeft, BadgeCheck, MapPin, Briefcase, Building2, Calendar, Banknote } from 'lucide-react';
import apiFetch from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';

export function CompanyProfilePage({ companyId, onBack, onSelectJob }) {
  const { t } = useLanguage();
  const [company, setCompany] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    apiFetch(`/companies/${companyId}`)
      .then(data => { setCompany(data.company); setJobs(data.jobs || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [companyId]);

  if (loading) return <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading company profile...</div>;
  if (!company) return <div style={{ padding: 24 }}>Company not found.</div>;

  const isVerified = company.trust_tier === 'tier_1_reviewed';

  const formatPay = (min, max, period) => {
    if (!min && !max) return null;
    const fmt = (n) => n ? `MWK ${parseInt(n).toLocaleString()}` : '';
    const range = min && max ? `${fmt(min)} – ${fmt(max)}` : fmt(min || max);
    return `${range} / ${period || 'month'}`;
  };

  return (
    <div style={{ padding: '16px 12px' }}>
      <button className="btn-secondary" onClick={onBack} style={{ width: 'auto', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
        <ArrowLeft size={16} /> Back
      </button>

      {/* Company Header */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 54, height: 54, borderRadius: 12, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Building2 size={26} color="var(--primary)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.3rem', fontWeight: 800 }}>{company.display_name}</h1>
              {isVerified && (
                <span className="badge badge-verified" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <BadgeCheck size={13} /> Verified Employer
                </span>
              )}
            </div>
            {company.location_district && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <MapPin size={13} /> {company.location_district}, Malawi
              </div>
            )}
          </div>
        </div>

        {company.business_reg_number && (
          <div style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-main)', padding: '6px 10px', borderRadius: 6 }}>
            <BadgeCheck size={13} color="var(--text-muted)" />
            Business Reg: {company.business_reg_number}
          </div>
        )}

        <div style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Member since {new Date(company.created_at).toLocaleDateString('en-MW', { year: 'numeric', month: 'long' })}
        </div>

        {!isVerified && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'flex-start', gap: 8, background: 'var(--amber-light)', borderRadius: 8, padding: '8px 12px', border: '1px solid var(--amber)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--amber-dark)' }}>
              This company has not yet received a platform verification badge. Exercise caution.
            </span>
          </div>
        )}
      </div>

      {/* Active Jobs */}
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Briefcase size={18} color="var(--primary)" />
        Active Opportunities ({jobs.length})
      </h2>

      {jobs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
          No active job listings from this company right now.
        </div>
      ) : (
        jobs.map(job => {
          const pay = formatPay(job.pay_amount_min, job.pay_amount_max, job.pay_period);
          const isExpired = job.application_deadline && new Date(job.application_deadline) < new Date();

          return (
            <div key={job.id} className="card" style={{ marginBottom: 10, opacity: isExpired ? 0.65 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <span className="badge badge-type" style={{ marginBottom: 4 }}>
                    {t(`type_${job.opportunity_type}`) || job.opportunity_type}
                  </span>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginTop: 4 }}>{job.title}</h3>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {job.location_district && <span><MapPin size={12} style={{ display: 'inline' }} /> {job.location_district}</span>}
                    {pay && <span><Banknote size={12} style={{ display: 'inline' }} /> {pay}</span>}
                    {job.application_deadline && (
                      <span style={{ color: isExpired ? 'var(--danger)' : 'var(--text-muted)' }}>
                        <Calendar size={12} style={{ display: 'inline' }} /> Deadline: {new Date(job.application_deadline).toLocaleDateString()}
                        {isExpired ? ' (Closed)' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {!isExpired && onSelectJob && (
                <button className="btn-primary" style={{ marginTop: 10, padding: '8px 14px', fontSize: '0.82rem', width: 'auto' }}
                  onClick={() => onSelectJob(job.id)}>
                  View & Apply
                </button>
              )}
              {isExpired && (
                <span className="badge" style={{ marginTop: 8, background: 'var(--danger-light)', color: 'var(--danger)' }}>Applications Closed</span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

export default CompanyProfilePage;
