import React, { useState, useEffect } from 'react';
import { User, Plus, Trash2, Save, Award, CheckCircle2 } from 'lucide-react';
import apiFetch from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const MALAWI_DISTRICTS = ['Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba', 'Kasungu', 'Salima', 'Mangochi', 'Karonga'];

export function ProfilePage() {
  const { t } = useLanguage();
  const { user, refreshUserData } = useAuth();

  const [profile, setProfile] = useState(null);
  const [userSkills, setUserSkills] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);

  // Profile Form state
  const [fullName, setFullName] = useState('');
  const [district, setDistrict] = useState('Lilongwe');
  const [bio, setBio] = useState('');
  const [highestEducation, setHighestEducation] = useState('Secondary School');
  const [openToGigWork, setOpenToGigWork] = useState(true);
  const [openToRelocation, setOpenToRelocation] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState('');

  // Skill Add Form state
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [customSkillName, setCustomSkillName] = useState('');
  const [proficiency, setProficiency] = useState('intermediate');
  const [yearsExperience, setYearsExperience] = useState('1.0');
  const [addingSkill, setAddingSkill] = useState(false);

  useEffect(() => {
    async function loadProfileData() {
      setLoading(true);
      try {
        const [profileData, catalogData] = await Promise.all([
          apiFetch('/profiles/me'),
          apiFetch('/profiles/skills/catalog')
        ]);

        setProfile(profileData.profile);
        setUserSkills(profileData.skills || []);
        setCatalog(catalogData.skills || []);

        if (profileData.profile) {
          setFullName(profileData.profile.full_name || '');
          setDistrict(profileData.profile.location_district || 'Lilongwe');
          setBio(profileData.profile.bio || '');
          setHighestEducation(profileData.profile.highest_education || 'Secondary School');
          setOpenToGigWork(profileData.profile.open_to_gig_work ?? true);
          setOpenToRelocation(profileData.profile.open_to_relocation ?? false);
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setLoading(false);
      }
    }

    if (user?.role === 'job_seeker') {
      loadProfileData();
    }
  }, [user]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSavedMsg('');
    try {
      const res = await apiFetch('/profiles/me', {
        method: 'PUT',
        body: JSON.stringify({
          fullName,
          locationDistrict: district,
          bio,
          highestEducation,
          openToGigWork,
          openToRelocation
        })
      });
      setProfile(res.profile);
      setProfileSavedMsg('Profile updated successfully!');
      refreshUserData();
      setTimeout(() => setProfileSavedMsg(''), 2500);
    } catch (err) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddSkill = async (e) => {
    e.preventDefault();
    if (!selectedSkillId && !customSkillName.trim()) return;

    setAddingSkill(true);
    try {
      const res = await apiFetch('/profiles/me/skills', {
        method: 'POST',
        body: JSON.stringify({
          skillId: selectedSkillId || null,
          skillName: customSkillName.trim() || null,
          proficiency,
          yearsExperience: parseFloat(yearsExperience) || 0
        })
      });

      setUserSkills(prev => [...prev.filter(s => s.skill_id !== res.userSkill.skill_id), res.userSkill]);
      setSelectedSkillId('');
      setCustomSkillName('');
    } catch (err) {
      alert(err.message || 'Failed to add skill');
    } finally {
      setAddingSkill(false);
    }
  };

  const handleDeleteSkill = async (skillId) => {
    try {
      await apiFetch(`/profiles/me/skills/${skillId}`, { method: 'DELETE' });
      setUserSkills(prev => prev.filter(s => s.skill_id !== skillId));
    } catch (err) {
      alert('Failed to remove skill');
    }
  };

  if (loading) {
    return <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading seeker profile...</div>;
  }

  const completenessItems = [
    { label: 'Full Name', met: fullName.trim().length > 0 },
    { label: 'District Location', met: district.trim().length > 0 },
    { label: 'Bio / Intro', met: bio.trim().length >= 10 },
    { label: 'Education Level', met: !!highestEducation },
    { label: 'At least 1 Skill', met: userSkills.length > 0 }
  ];
  const completenessPercent = Math.round((completenessItems.filter(i => i.met).length / completenessItems.length) * 100);

  return (
    <div style={{ padding: '16px 12px' }}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 16 }}>{t('nav_profile')}</h1>

      {/* Profile Completeness Bar */}
      <div className="card" style={{ marginBottom: 16, background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.9rem' }}>
            <Award size={16} color="var(--primary)" />
            Profile Completeness
          </div>
          <span style={{ fontWeight: 800, color: completenessPercent === 100 ? 'var(--success)' : 'var(--primary)', fontSize: '0.9rem' }}>
            {completenessPercent}%
          </span>
        </div>

        <div style={{ width: '100%', height: 8, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
          <div
            style={{
              width: `${completenessPercent}%`,
              height: '100%',
              background: completenessPercent === 100 ? 'var(--success)' : 'var(--primary)',
              borderRadius: 999,
              transition: 'width 0.3s ease'
            }}
          />
        </div>

        {completenessPercent < 100 && (
          <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Missing: {completenessItems.filter(i => !i.met).map(i => i.label).join(' • ')} (higher completeness increases your SkillMatch score for jobs).
          </div>
        )}
      </div>

      {profileSavedMsg && (
        <div style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: 12, borderRadius: 8, fontSize: '0.85rem', marginBottom: 16, fontWeight: 700 }}>
          ✓ {profileSavedMsg}
        </div>
      )}

      {/* Profile Form */}
      <div className="card">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>Personal Information</h2>
        <form onSubmit={handleSaveProfile}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input type="text" className="form-input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">District Location</label>
            <select className="form-select" value={district} onChange={(e) => setDistrict(e.target.value)}>
              {MALAWI_DISTRICTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Bio / Short Intro</label>
            <textarea className="form-textarea" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell employers about your work experience & aspirations..." />
          </div>

          <div className="form-group">
            <label className="form-label">Highest Education</label>
            <select className="form-select" value={highestEducation} onChange={(e) => setHighestEducation(e.target.value)}>
              <option value="Primary School">Primary School</option>
              <option value="Secondary School (MSCE)">Secondary School (MSCE)</option>
              <option value="Vocational / Trade Certificate">Vocational / Trade Certificate</option>
              <option value="Diploma">Diploma</option>
              <option value="Bachelor's Degree">Bachelor's Degree</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
              <input type="checkbox" checked={openToGigWork} onChange={(e) => setOpenToGigWork(e.target.checked)} />
              Open to short-term gig work & contracts
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
              <input type="checkbox" checked={openToRelocation} onChange={(e) => setOpenToRelocation(e.target.checked)} />
              Open to relocation across districts
            </label>
          </div>

          <button type="submit" className="btn-primary" disabled={savingProfile}>
            <Save size={16} /> {savingProfile ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>

      {/* Skills Manager */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>My Skills Portfolio</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{userSkills.length} skills listed</span>
        </div>

        {/* List Current Skills */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {userSkills.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No skills added yet. Add your trades or digital skills below!</div>
          ) : (
            userSkills.map(s => (
              <div key={s.skill_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, background: 'var(--bg-main)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{s.skill_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Proficiency: <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{s.proficiency}</span> • {s.years_experience || 1} yrs exp
                  </div>
                </div>
                <button onClick={() => handleDeleteSkill(s.skill_id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4 }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add Skill Form */}
        <form onSubmit={handleAddSkill} style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 12 }}>Add New Skill</h3>

          <div className="form-group">
            <label className="form-label">Select Skill from Trade Catalog</label>
            <select className="form-select" value={selectedSkillId} onChange={(e) => setSelectedSkillId(e.target.value)}>
              <option value="">-- Choose Trade / Digital Skill --</option>
              {catalog.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.category})</option>
              ))}
            </select>
          </div>

          {!selectedSkillId && (
            <div className="form-group">
              <label className="form-label">Or Type Custom Skill</label>
              <input type="text" className="form-input" placeholder="e.g. Solar PV Wiring" value={customSkillName} onChange={(e) => setCustomSkillName(e.target.value)} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Proficiency</label>
              <select className="form-select" value={proficiency} onChange={(e) => setProficiency(e.target.value)}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Years Exp</label>
              <input type="number" step="0.5" className="form-input" value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} />
            </div>
          </div>

          <button type="submit" className="btn-secondary" disabled={addingSkill}>
            <Plus size={16} style={{ display: 'inline', marginRight: 4 }} /> {addingSkill ? 'Adding...' : 'Add Skill to Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ProfilePage;
