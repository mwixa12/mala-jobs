import React from 'react';
import { X, CheckCircle2, XCircle, Sparkles, Award } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';

export function SkillMatchModal({ match, onClose }) {
  const { t } = useLanguage();

  if (!match) return null;

  const { matchPercentage, buckets, summary } = match;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Award size={22} color="var(--primary)" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>SkillMatch Breakdown</h3>
          </div>
          <button className="bell-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Match Percentage Pill Banner */}
        <div
          style={{
            backgroundColor: matchPercentage >= 80 ? '#d1fae5' : matchPercentage >= 50 ? '#fef3c7' : '#f1f5f9',
            color: matchPercentage >= 80 ? '#065f46' : matchPercentage >= 50 ? '#92400e' : '#334155',
            borderRadius: 12,
            padding: '16px',
            textAlign: 'center',
            marginBottom: 20
          }}
        >
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{matchPercentage}% Match</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: 4 }}>{summary}</div>
        </div>

        {/* 1. Met Required Skills */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <CheckCircle2 size={16} />
            {t('required_met')} ({buckets.met.length})
          </div>
          {buckets.met.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>None matched yet.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {buckets.met.map((s) => (
                <span key={s.skillId} className="badge" style={{ backgroundColor: '#d1fae5', color: '#065f46' }}>
                  {s.skillName} • {s.proficiency}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 2. Missing Required Skills */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <XCircle size={16} />
            {t('missing_required')} ({buckets.missing.length})
          </div>
          {buckets.missing.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>Great job! You have all required skills.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {buckets.missing.map((s) => (
                <span key={s.skillId} className="badge" style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)' }}>
                  {s.skillName}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 3. Nice-to-Have Would Strengthen */}
        {buckets.wouldStrengthen.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Sparkles size={16} />
              {t('would_strengthen')} ({buckets.wouldStrengthen.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {buckets.wouldStrengthen.map((s) => (
                <span
                  key={s.skillId}
                  className="badge"
                  style={{
                    backgroundColor: s.seekerHasSkill ? 'var(--amber-light)' : 'var(--bg-main)',
                    color: s.seekerHasSkill ? 'var(--amber)' : 'var(--text-muted)',
                    border: '1px solid var(--border)'
                  }}
                >
                  {s.skillName} {s.seekerHasSkill ? '★ Bonus' : '(Nice-to-have)'}
                </span>
              ))}
            </div>
          </div>
        )}

        <button className="btn-primary" onClick={onClose} style={{ marginTop: 12 }}>
          Close Breakdown
        </button>
      </div>
    </div>
  );
}

export default SkillMatchModal;
