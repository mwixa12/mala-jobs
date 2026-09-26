import React, { useState, useEffect } from 'react';
import { ArrowLeft, Send, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import apiFetch from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';

const MALAWI_DISTRICTS = ['Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba', 'Kasungu', 'Salima', 'Mangochi', 'Karonga'];

export function PostJobPage({ onBack, onJobPosted }) {
  const { t } = useLanguage();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [opportunityType, setOpportunityType] = useState('formal_job');
  const [locationDistrict, setLocationDistrict] = useState('Lilongwe');
  const [isRemote, setIsRemote] = useState(false);
  const [payAmountMin, setPayAmountMin] = useState('');
  const [payAmountMax, setPayAmountMax] = useState('');
  const [payPeriod, setPayPeriod] = useState('monthly');
  const [applicationDeadline, setApplicationDeadline] = useState('');

  const [catalog, setCatalog] = useState([]);
  const [requiredSkillIds, setRequiredSkillIds] = useState([]);
  const [niceToHaveSkillIds, setNiceToHaveSkillIds] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState(null);
  const [postError, setPostError] = useState('');

  useEffect(() => {
    async function loadCatalog() {
      try {
        const data = await apiFetch('/profiles/skills/catalog');
        setCatalog(data.skills || []);
      } catch (err) {
        console.error('Failed to load skills catalog:', err);
      }
    }
    loadCatalog();
  }, []);

  const toggleSkill = (skillId, isRequired) => {
    if (isRequired) {
      setRequiredSkillIds(prev =>
        prev.includes(skillId) ? prev.filter(id => id !== skillId) : [...prev, skillId]
      );
      setNiceToHaveSkillIds(prev => prev.filter(id => id !== skillId));
    } else {
      setNiceToHaveSkillIds(prev =>
        prev.includes(skillId) ? prev.filter(id => id !== skillId) : [...prev, skillId]
      );
      setRequiredSkillIds(prev => prev.filter(id => id !== skillId));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !description) return;

    setSubmitting(true);
    setResultMsg(null);
    setPostError('');

    try {
      const res = await apiFetch('/jobs', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          opportunityType,
          locationDistrict,
          isRemote,
          payAmountMin: payAmountMin ? parseFloat(payAmountMin) : null,
          payAmountMax: payAmountMax ? parseFloat(payAmountMax) : null,
          payPeriod,
          applicationDeadline: applicationDeadline || null,
          requiredSkillIds,
          niceToHaveSkillIds
        })
      });

      setResultMsg(res);
      setTimeout(() => {
        if (onJobPosted) onJobPosted();
      }, 2000);
    } catch (err) {
      setPostError(err.message || 'Failed to post opportunity. Please check all fields.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '16px 12px' }}>
      <button className="btn-secondary" onClick={onBack} style={{ width: 'auto', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <div className="card">
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 16 }}>Post New Opportunity</h1>

        {postError && (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              marginBottom: 16,
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            {postError}
          </div>
        )}

        {resultMsg && (
          <div
            style={{
              padding: 14,
              borderRadius: 8,
              marginBottom: 16,
              backgroundColor: resultMsg.qualityCheck.passed ? '#d1fae5' : 'var(--amber-light)',
              color: resultMsg.qualityCheck.passed ? '#065f46' : 'var(--amber)',
              fontWeight: 600,
              fontSize: '0.9rem'
            }}
          >
            {resultMsg.qualityCheck.passed ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={18} /> {resultMsg.message}
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                  <AlertTriangle size={18} /> Queued for Review
                </div>
                <div style={{ fontSize: '0.8rem', marginTop: 4 }}>{resultMsg.qualityCheck.reason}</div>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Opportunity Title</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Solar Installation Technician"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Opportunity Type</label>
            <select className="form-select" value={opportunityType} onChange={(e) => setOpportunityType(e.target.value)}>
              <option value="formal_job">Formal Job</option>
              <option value="internship">Internship</option>
              <option value="apprenticeship">Apprenticeship</option>
              <option value="gig">Gig Work</option>
              <option value="informal">Informal Contract</option>
              <option value="self_employment_resource">Self-Employment Resource</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Location District</label>
            <select className="form-select" value={locationDistrict} onChange={(e) => setLocationDistrict(e.target.value)}>
              {MALAWI_DISTRICTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="remoteCheck" checked={isRemote} onChange={(e) => setIsRemote(e.target.checked)} />
            <label htmlFor="remoteCheck" style={{ fontSize: '0.85rem' }}>Remote / Work from home opportunity</label>
          </div>

          <div className="form-group">
            <label className="form-label">Description & Requirements</label>
            <textarea
              className="form-textarea"
              rows={4}
              placeholder="Describe tasks, working conditions, and expectations..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          {/* Pay Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Min Pay (MWK)</label>
              <input type="number" className="form-input" placeholder="150000" value={payAmountMin} onChange={(e) => setPayAmountMin(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Max Pay (MWK)</label>
              <input type="number" className="form-input" placeholder="250000" value={payAmountMax} onChange={(e) => setPayAmountMax(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Pay Period</label>
            <select className="form-select" value={payPeriod} onChange={(e) => setPayPeriod(e.target.value)}>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="monthly">Monthly</option>
              <option value="project">Per Project</option>
              <option value="one-time">One-time Grant</option>
            </select>
          </div>

          {/* Required vs Nice-to-Have Skills Selector */}
          <div style={{ marginBottom: 20 }}>
            <label className="form-label">Select Required & Recommended Trade Skills</label>
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
              {catalog.map((skill) => {
                const isReq = requiredSkillIds.includes(skill.id);
                const isNice = niceToHaveSkillIds.includes(skill.id);

                return (
                  <div key={skill.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.85rem' }}>{skill.name}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        className="badge"
                        style={{
                          backgroundColor: isReq ? 'var(--primary)' : 'var(--bg-main)',
                          color: isReq ? '#fff' : 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                        onClick={() => toggleSkill(skill.id, true)}
                      >
                        Required
                      </button>
                      <button
                        type="button"
                        className="badge"
                        style={{
                          backgroundColor: isNice ? 'var(--amber)' : 'var(--bg-main)',
                          color: isNice ? '#fff' : 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                        onClick={() => toggleSkill(skill.id, false)}
                      >
                        Nice-to-have
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={submitting}>
            <Send size={16} /> {submitting ? 'Checking Quality & Publishing...' : 'Post Opportunity'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default PostJobPage;
