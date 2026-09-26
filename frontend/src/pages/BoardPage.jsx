import React, { useState, useEffect } from 'react';
import { Search, MapPin, Briefcase, AlertTriangle, ShieldCheck, ChevronRight, Award, Bookmark, BadgeCheck } from 'lucide-react';
import apiFetch from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import SkillMatchModal from '../components/SkillMatchModal.jsx';

const MALAWI_DISTRICTS = [
  'All', 'Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba', 'Kasungu', 'Salima', 'Mangochi', 'Karonga', 'Nkhotakota'
];

const OPPORTUNITY_TYPES = [
  { key: 'All', labelKey: 'filter_all_types' },
  { key: 'formal_job', labelKey: 'type_formal_job' },
  { key: 'internship', labelKey: 'label_internship' },
  { key: 'apprenticeship', labelKey: 'label_apprenticeship' },
  { key: 'gig', labelKey: 'type_gig' },
  { key: 'informal', labelKey: 'type_informal' },
  { key: 'self_employment_resource', labelKey: 'type_self_employment_resource' }
];

export function BoardPage({ onSelectJob, onSelectCompany }) {
  const { t } = useLanguage();

  const [jobs, setJobs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const [selectedDistrict, setSelectedDistrict] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  // Saved / Bookmarked jobs in LocalStorage
  const [savedJobIds, setSavedJobIds] = useState(() => {
    try {
      const stored = localStorage.getItem('malajobs_saved_jobs');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const toggleBookmark = (e, jobId) => {
    e.stopPropagation();
    setSavedJobIds((prev) => {
      const updated = prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId];
      try {
        localStorage.setItem('malajobs_saved_jobs', JSON.stringify(updated));
      } catch (err) {
        console.error('LocalStorage write failed:', err);
      }
      return updated;
    });
  };

  const [activeMatchModal, setActiveMatchModal] = useState(null);

  const fetchJobs = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });
      if (selectedDistrict !== 'All') params.append('district', selectedDistrict);
      if (selectedType !== 'All') params.append('opportunityType', selectedType);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const data = await apiFetch(`/jobs?${params.toString()}`);
      setJobs(data.jobs || []);
      setPagination(data.pagination || { page: 1, totalPages: 1 });
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs(1);
  }, [selectedDistrict, selectedType]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchJobs(1);
  };

  return (
    <div style={{ padding: '16px 12px' }}>
      {/* Title */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{t('board_title')}</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('board_subtitle')}</p>
      </div>

      {/* Search Input */}
      <form onSubmit={handleSearchSubmit} style={{ marginBottom: 12 }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: 38 }}
            placeholder={t('search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </form>

      {/* District Filter Pills */}
      <div className="filter-scroll" style={{ marginBottom: 8 }}>
        {MALAWI_DISTRICTS.map((dist) => (
          <button
            key={dist}
            className={`filter-chip ${selectedDistrict === dist ? 'active' : ''}`}
            onClick={() => setSelectedDistrict(dist)}
          >
            <MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />
            {dist === 'All' ? t('filter_all_districts') : dist}
          </button>
        ))}
      </div>

      {/* Opportunity Type & Saved Filter Pills */}
      <div className="filter-scroll" style={{ marginBottom: 16 }}>
        <button
          className={`filter-chip ${showSavedOnly ? 'active' : ''}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...(showSavedOnly ? { background: 'var(--primary)', color: '#fff' } : {}) }}
          onClick={() => setShowSavedOnly(!showSavedOnly)}
        >
          <Bookmark size={12} fill={showSavedOnly ? '#fff' : 'none'} />
          Saved Jobs ({savedJobIds.length})
        </button>

        {OPPORTUNITY_TYPES.map((typeObj) => (
          <button
            key={typeObj.key}
            className={`filter-chip ${!showSavedOnly && selectedType === typeObj.key ? 'active' : ''}`}
            onClick={() => { setShowSavedOnly(false); setSelectedType(typeObj.key); }}
          >
            {typeObj.key === 'All' ? t('filter_all_types') : (t(typeObj.labelKey) || typeObj.key)}
          </button>
        ))}
      </div>

      {/* Opportunity Cards List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          Loading opportunities...
        </div>
      ) : (showSavedOnly ? jobs.filter(j => savedJobIds.includes(j.id)) : jobs).length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            {showSavedOnly
              ? "You haven't bookmarked any jobs yet. Tap the bookmark icon on any card to save it."
              : `No matching opportunities found in ${selectedDistrict !== 'All' ? selectedDistrict : 'Malawi'}.`}
          </p>
        </div>
      ) : (
        (showSavedOnly ? jobs.filter(j => savedJobIds.includes(j.id)) : jobs).map((job) => {
          const isVerified = job.employer_trust_tier === 'tier_1_reviewed';
          const isUnverified = job.employer_trust_tier === 'unverified' || job.employer_trust_tier === 'tier_0_phone';
          const isBookmarked = savedJobIds.includes(job.id);
          const isClosed = job.application_deadline && new Date(job.application_deadline) < new Date();

          return (
            <div key={job.id} className="card opportunity-card" onClick={() => onSelectJob(job.id)} style={{ position: 'relative' }}>
              <div className="opportunity-header">
                <div style={{ flex: 1, paddingRight: 8 }}>
                  <h3 className="op-title">{job.title}</h3>
                  <div className="op-employer" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', textAlign: 'left', textDecoration: 'underline' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectCompany) onSelectCompany(job.employer_id);
                      }}
                    >
                      {job.employer_name}
                    </button>
                    {isVerified && <BadgeCheck size={14} color="#059669" />}
                    {job.location_district ? <span>• {job.location_district}</span> : ''}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* Bookmark Button */}
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: isBookmarked ? 'var(--primary)' : 'var(--text-muted)' }}
                    onClick={(e) => toggleBookmark(e, job.id)}
                    title={isBookmarked ? 'Remove bookmark' : 'Save job'}
                    aria-label="Save job"
                  >
                    <Bookmark size={18} fill={isBookmarked ? 'var(--primary)' : 'none'} />
                  </button>

                  {/* Match % Pill if Seeker Logged In */}
                  {job.match && (
                    <button
                      className={`match-pill ${
                        job.match.matchPercentage >= 80 ? 'match-high' : job.match.matchPercentage >= 50 ? 'match-medium' : 'match-low'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMatchModal(job.match);
                      }}
                      title="View SkillMatch breakdown"
                    >
                      <Award size={14} />
                      {job.match.matchPercentage}%
                    </button>
                  )}
                </div>
              </div>

              {/* Badges & Trust Tier */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span className="badge badge-type">
                  <Briefcase size={12} />
                  {t(`type_${job.opportunity_type}`) || job.opportunity_type}
                </span>

                {isVerified && (
                  <span className="badge badge-verified">
                    <ShieldCheck size={12} />
                    {t('trust_tier_verified')}
                  </span>
                )}

                {isClosed && (
                  <span className="badge" style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)' }}>
                    CLOSED
                  </span>
                )}

                {job.has_applied && (
                  <span className="badge" style={{ backgroundColor: '#d1fae5', color: '#065f46', fontWeight: 700 }}>
                    ✓ Applied
                  </span>
                )}
              </div>

              {/* Mandatory Feature 7: Visible Caution Note for Unverified Employers */}
              {isUnverified && (
                <div className="caution-note">
                  <AlertTriangle size={14} />
                  {t('trust_tier_caution')}
                </div>
              )}

              {/* Pay & Deadline */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: 6 }}>
                <span>
                  {job.pay_amount_min
                    ? `MWK ${Number(job.pay_amount_min).toLocaleString()} ${job.pay_amount_max ? `- ${Number(job.pay_amount_max).toLocaleString()}` : ''} / ${job.pay_period || 'month'}`
                    : 'Pay: Negotiable / Grants'}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {job.application_deadline && (
                    <span style={{ fontSize: '0.78rem', color: isClosed ? 'var(--danger)' : 'var(--text-muted)' }}>
                      Deadline: {new Date(job.application_deadline).toLocaleDateString()}
                    </span>
                  )}
                  <ChevronRight size={18} color="var(--primary)" />
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <button
            className="btn-secondary"
            disabled={pagination.page <= 1}
            onClick={() => fetchJobs(pagination.page - 1)}
            style={{ width: 'auto', padding: '8px 16px' }}
          >
            Previous
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            className="btn-secondary"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => fetchJobs(pagination.page + 1)}
            style={{ width: 'auto', padding: '8px 16px' }}
          >
            Next
          </button>
        </div>
      )}

      {/* SkillMatch Modal */}
      {activeMatchModal && (
        <SkillMatchModal match={activeMatchModal} onClose={() => setActiveMatchModal(null)} />
      )}
    </div>
  );
}

export default BoardPage;
