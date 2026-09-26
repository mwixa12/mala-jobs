import React, { useState, useEffect } from 'react';
import { Phone, Mail, Lock, User, Building, ArrowRight, ShieldCheck, CheckCircle, KeyRound, Trash2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export function AuthPage({ onAuthenticated }) {
  const { t } = useLanguage();
  const { 
    login, 
    loginSeeker, 
    registerSeeker, 
    requestOtp, 
    verifyOtp, 
    sendEmployerEmailCode, 
    registerEmployer, 
    loginEmployer, 
    loginAdmin 
  } = useAuth();

  const [activeTab, setActiveTab] = useState('seeker'); // 'seeker' | 'employer' | 'admin'

  // Saved accounts from device localStorage
  const [savedAccounts, setSavedAccounts] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('malajobs_saved_accounts');
      if (raw) {
        setSavedAccounts(JSON.parse(raw));
      }
    } catch (e) {
      // Ignore
    }
  }, []);

  const handleSelectSavedAccount = (acc) => {
    if (acc.role === 'employer') {
      setActiveTab('employer');
      setIsEmployerRegister(false);
      setEmployerEmail(acc.email || acc.identifier);
    } else {
      setActiveTab('seeker');
      setSeekerAuthMethod('email');
      setIsSeekerRegister(false);
      setSeekerEmail(acc.email || acc.identifier);
    }
    setErrorMsg('');
    setSuccessMsg(`Selected account: ${acc.identifier}. Enter your password to sign in.`);
  };

  const handleRemoveSavedAccount = (identifier, e) => {
    e.stopPropagation();
    const updated = savedAccounts.filter(a => a.identifier !== identifier && a.email !== identifier);
    setSavedAccounts(updated);
    try {
      localStorage.setItem('malajobs_saved_accounts', JSON.stringify(updated));
    } catch (err) {
      // Ignore
    }
  };

  // Seeker State
  const [seekerAuthMethod, setSeekerAuthMethod] = useState('email'); // 'email' | 'phone'
  const [isSeekerRegister, setIsSeekerRegister] = useState(false);
  const [seekerEmail, setSeekerEmail] = useState(() => localStorage.getItem('malajobs_last_email') || '');
  const [seekerPassword, setSeekerPassword] = useState('');
  const [seekerFullName, setSeekerFullName] = useState('');
  const [seekerPhone, setSeekerPhone] = useState('+265');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [debugCodeHint, setDebugCodeHint] = useState('');

  // Employer State
  const [isEmployerRegister, setIsEmployerRegister] = useState(false);
  const [employerEmail, setEmployerEmail] = useState(() => localStorage.getItem('malajobs_last_email') || '');
  const [employerPassword, setEmployerPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [district, setDistrict] = useState('Lilongwe');
  const [isOrg, setIsOrg] = useState(false);
  const [businessRegNumber, setBusinessRegNumber] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailVerificationCode, setEmailVerificationCode] = useState('123456');
  const [emailDebugCode, setEmailDebugCode] = useState('');

  // Admin State
  const [adminEmail, setAdminEmail] = useState('admin@malajobs.mw');
  const [adminPassword, setAdminPassword] = useState('admin123');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 1. Seeker Email + Password Login / Register
  const handleSeekerEmailAuth = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      if (isSeekerRegister) {
        if (!seekerEmail || !seekerPassword) {
          throw new Error('Please enter both email and password');
        }
        if (seekerPassword.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        await registerSeeker({
          email: seekerEmail,
          password: seekerPassword,
          fullName: seekerFullName,
          phoneNumber: seekerPhone && seekerPhone !== '+265' ? seekerPhone : null
        });
        setSuccessMsg('Account saved successfully! Logging in...');
      } else {
        await loginSeeker(seekerEmail, seekerPassword);
      }
      if (onAuthenticated) onAuthenticated();
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Seeker Phone OTP Handlers
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      const res = await requestOtp(seekerPhone);
      setOtpSent(true);
      if (res.debugCode) setDebugCodeHint(res.debugCode);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to send OTP code');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      await verifyOtp(seekerPhone, otpCode, seekerFullName);
      if (onAuthenticated) onAuthenticated();
    } catch (err) {
      setErrorMsg(err.message || 'Invalid verification code');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Employer Verification Code
  const handleSendEmployerEmailCode = async (e) => {
    if (e) e.preventDefault();
    if (!employerEmail || !employerEmail.includes('@')) {
      setErrorMsg('Please enter a valid company email address');
      return;
    }
    if (!displayName.trim()) {
      setErrorMsg('Please enter your company or business name');
      return;
    }
    if (!employerPassword || employerPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters');
      return;
    }

    setErrorMsg('');
    setSubmitting(true);
    try {
      const res = await sendEmployerEmailCode(employerEmail);
      setEmailCodeSent(true);
      if (res.debugCode) {
        setEmailDebugCode(res.debugCode);
        setEmailVerificationCode(res.debugCode);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to send verification code');
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Employer Auth (Login / Register)
  const handleEmployerAuth = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (isEmployerRegister && !emailCodeSent) {
      return handleSendEmployerEmailCode(e);
    }

    setSubmitting(true);
    try {
      if (isEmployerRegister) {
        await registerEmployer({
          email: employerEmail,
          password: employerPassword,
          displayName,
          locationDistrict: district,
          isOrganization: isOrg,
          businessRegNumber: businessRegNumber || null,
          phoneNumber: phoneNumber || null,
          verificationCode: emailVerificationCode || '123456'
        });
        setSuccessMsg('Employer account created and saved securely! Logging in...');
      } else {
        await loginEmployer(employerEmail, employerPassword);
      }
      if (onAuthenticated) onAuthenticated();
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Admin Login
  const handleAdminAuth = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      await loginAdmin(adminEmail, adminPassword);
      if (onAuthenticated) onAuthenticated();
    } catch (err) {
      setErrorMsg(err.message || 'Admin login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px' }}>
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 12, backgroundColor: 'var(--primary)', color: '#fff', marginBottom: 10 }}>
          <Building size={24} />
        </div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)', margin: '0 0 4px 0' }}>MalaJobs</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>Youth Employment & Skill Match Platform</p>
      </div>

      {/* Saved Accounts on this Device */}
      {savedAccounts.length > 0 && (
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', padding: '12px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <KeyRound size={14} color="var(--primary)" /> Saved Accounts on this Device
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {savedAccounts.map((acc) => (
              <div
                key={acc.identifier}
                onClick={() => handleSelectSavedAccount(acc)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 8,
                  backgroundColor: 'var(--bg-card-hover)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: acc.role === 'employer' ? '#dbeafe' : '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {acc.role === 'employer' ? <Building size={14} color="#1d4ed8" /> : <User size={14} color="#15803d" />}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{acc.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{acc.identifier}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 12, fontWeight: 600, backgroundColor: acc.role === 'employer' ? '#eff6ff' : '#f0fdf4', color: acc.role === 'employer' ? '#1d4ed8' : '#15803d' }}>
                    {acc.role === 'employer' ? 'Employer' : 'Job Seeker'}
                  </span>
                  <button
                    type="button"
                    title="Remove from saved list"
                    onClick={(e) => handleRemoveSavedAccount(acc.identifier, e)}
                    style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Role Navigation Tabs */}
      <div style={{ display: 'flex', backgroundColor: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', padding: 4, marginBottom: 20 }}>
        <button
          style={{
            flex: 1,
            padding: '10px 0',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'seeker' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'seeker' ? '#fff' : 'var(--text-main)',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onClick={() => { setActiveTab('seeker'); setErrorMsg(''); setSuccessMsg(''); }}
        >
          Job Seeker
        </button>
        <button
          style={{
            flex: 1,
            padding: '10px 0',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'employer' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'employer' ? '#fff' : 'var(--text-main)',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onClick={() => { setActiveTab('employer'); setErrorMsg(''); setSuccessMsg(''); }}
        >
          Employer
        </button>
        <button
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'admin' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'admin' ? '#fff' : 'var(--text-main)',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onClick={() => { setActiveTab('admin'); setErrorMsg(''); setSuccessMsg(''); }}
        >
          Admin
        </button>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)', padding: 12, borderRadius: 8, fontSize: '0.85rem', marginBottom: 16 }}>
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: 12, borderRadius: 8, fontSize: '0.85rem', marginBottom: 16, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={16} /> {successMsg}
        </div>
      )}

      {/* ================= TAB 1: JOB SEEKER ================= */}
      {activeTab === 'seeker' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              {isSeekerRegister ? 'Create Job Seeker Account' : 'Job Seeker Sign In'}
            </h2>
            {/* Seeker Auth Method Toggle */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-main)', padding: 2, borderRadius: 8, border: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => { setSeekerAuthMethod('email'); setErrorMsg(''); }}
                style={{
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: 6,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: seekerAuthMethod === 'email' ? 'var(--primary)' : 'transparent',
                  color: seekerAuthMethod === 'email' ? '#fff' : 'var(--text-muted)'
                }}
              >
                Email
              </button>
              <button
                type="button"
                onClick={() => { setSeekerAuthMethod('phone'); setErrorMsg(''); }}
                style={{
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: 6,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: seekerAuthMethod === 'phone' ? 'var(--primary)' : 'transparent',
                  color: seekerAuthMethod === 'phone' ? '#fff' : 'var(--text-muted)'
                }}
              >
                Phone SMS
              </button>
            </div>
          </div>

          {/* Seeker Method A: Email + Password */}
          {seekerAuthMethod === 'email' && (
            <form onSubmit={handleSeekerEmailAuth}>
              {isSeekerRegister && (
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <div style={{ position: 'relative' }}>
                    <User size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      name="name"
                      autoComplete="name"
                      className="form-input"
                      style={{ paddingLeft: 38 }}
                      placeholder="e.g. Kondwani Phiri"
                      value={seekerFullName}
                      onChange={(e) => setSeekerFullName(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                  <input
                    type="email"
                    name="email"
                    autoComplete="username"
                    className="form-input"
                    style={{ paddingLeft: 38 }}
                    placeholder="seeker@example.com"
                    value={seekerEmail}
                    onChange={(e) => setSeekerEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Password *</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                  <input
                    type="password"
                    name="password"
                    autoComplete={isSeekerRegister ? 'new-password' : 'current-password'}
                    className="form-input"
                    style={{ paddingLeft: 38 }}
                    placeholder="••••••••"
                    value={seekerPassword}
                    onChange={(e) => setSeekerPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {isSeekerRegister && (
                <div className="form-group">
                  <label className="form-label">Phone Number (Optional for SMS Alerts)</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                    <input
                      type="tel"
                      name="tel"
                      autoComplete="tel"
                      className="form-input"
                      style={{ paddingLeft: 38 }}
                      placeholder="+265..."
                      value={seekerPhone}
                      onChange={(e) => setSeekerPhone(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Please wait...' : (isSeekerRegister ? 'Create & Save Account' : 'Sign In as Job Seeker')}
                <ArrowRight size={16} />
              </button>

              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsSeekerRegister(!isSeekerRegister);
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  {isSeekerRegister ? 'Already registered? Sign in to your account' : 'First time here? Create a Job Seeker account'}
                </button>
              </div>
            </form>
          )}

          {/* Seeker Method B: Phone OTP */}
          {seekerAuthMethod === 'phone' && (
            <>
              {!otpSent ? (
                <form onSubmit={handleRequestOtp}>
                  <div className="form-group">
                    <label className="form-label">{t('phone_label')}</label>
                    <div style={{ position: 'relative' }}>
                      <Phone size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                      <input
                        type="tel"
                        name="tel"
                        autoComplete="tel"
                        className="form-input"
                        style={{ paddingLeft: 38 }}
                        placeholder="+265..."
                        value={seekerPhone}
                        onChange={(e) => setSeekerPhone(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? 'Sending SMS...' : t('request_otp_btn')} <ArrowRight size={16} />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp}>
                  <div style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-dark)', padding: 12, borderRadius: 8, fontSize: '0.85rem', marginBottom: 14, border: '1px solid var(--primary)' }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>SMS Code Dispatched</div>
                    <div>Sent to <strong>{seekerPhone}</strong>.</div>
                    <div style={{ marginTop: 4, fontSize: '0.8rem' }}>Verification Code: <strong>{debugCodeHint || '123456'}</strong> (or enter <strong>123456</strong>)</div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Full Name (New Seekers)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Kondwani Phiri"
                      value={seekerFullName}
                      onChange={(e) => setSeekerFullName(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('otp_label')}</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="123456"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      required
                    />
                  </div>

                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? 'Verifying...' : t('verify_otp_btn')}
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ marginTop: 8 }}
                    onClick={() => setOtpSent(false)}
                  >
                    Change Phone Number
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      )}

      {/* ================= TAB 2: EMPLOYER ================= */}
      {activeTab === 'employer' && (
        <div className="card">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>
            {isEmployerRegister ? 'Register Your Company / Business' : t('employer_login_title')}
          </h2>

          <form onSubmit={handleEmployerAuth}>
            {isEmployerRegister && !emailCodeSent && (
              <>
                <div className="form-group">
                  <label className="form-label">Company / Business Name *</label>
                  <input
                    type="text"
                    name="organization"
                    autoComplete="organization"
                    className="form-input"
                    placeholder="e.g. Green Solar Ltd"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Business Registration Number (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. MBRS-2024-8891"
                    value={businessRegNumber}
                    onChange={(e) => setBusinessRegNumber(e.target.value)}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Required for Tier 1 Verified Badge review by administrators.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Phone Number *</label>
                  <input
                    type="tel"
                    name="tel"
                    autoComplete="tel"
                    className="form-input"
                    placeholder="+265..."
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">District Location</label>
                  <select className="form-select" value={district} onChange={(e) => setDistrict(e.target.value)}>
                    <option value="Lilongwe">Lilongwe</option>
                    <option value="Blantyre">Blantyre</option>
                    <option value="Mzuzu">Mzuzu</option>
                    <option value="Zomba">Zomba</option>
                    <option value="Kasungu">Kasungu</option>
                    <option value="Salima">Salima</option>
                    <option value="Mangochi">Mangochi</option>
                  </select>
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" id="orgCheck" checked={isOrg} onChange={(e) => setIsOrg(e.target.checked)} />
                  <label htmlFor="orgCheck" style={{ fontSize: '0.85rem' }}>Registered Corporate / Formal Organization</label>
                </div>

                <div className="form-group">
                  <label className="form-label">{t('email_label')} *</label>
                  <input
                    type="email"
                    name="email"
                    autoComplete="username"
                    className="form-input"
                    placeholder="contact@company.mw"
                    value={employerEmail}
                    onChange={(e) => setEmployerEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">{t('password_label')} *</label>
                  <input
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    className="form-input"
                    placeholder="••••••••"
                    value={employerPassword}
                    onChange={(e) => setEmployerPassword(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Sending code...' : 'Continue & Verify Email'}
                </button>
              </>
            )}

            {isEmployerRegister && emailCodeSent && (
              <>
                <div style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-dark)', padding: 12, borderRadius: 8, fontSize: '0.85rem', marginBottom: 16, border: '1px solid var(--primary)' }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Email Verification Code Sent</div>
                  <div>Verification code dispatched for <strong>{employerEmail}</strong>.</div>
                  <div style={{ marginTop: 4, fontSize: '0.8rem' }}>Verification Code: <strong>{emailDebugCode || '123456'}</strong> (or enter <strong>123456</strong>)</div>
                </div>

                <div className="form-group">
                  <label className="form-label">6-Digit Verification Code *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="123456"
                    maxLength={6}
                    value={emailVerificationCode}
                    onChange={(e) => setEmailVerificationCode(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Verifying & Saving...' : 'Save & Register Business'}
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  style={{ marginTop: 8 }}
                  onClick={() => setEmailCodeSent(false)}
                >
                  Edit Registration Details
                </button>
              </>
            )}

            {!isEmployerRegister && (
              <>
                <div className="form-group">
                  <label className="form-label">{t('email_label')}</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                    <input
                      type="email"
                      name="email"
                      autoComplete="username"
                      className="form-input"
                      style={{ paddingLeft: 38 }}
                      placeholder="contact@company.mw"
                      value={employerEmail}
                      onChange={(e) => setEmployerEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">{t('password_label')}</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                    <input
                      type="password"
                      name="password"
                      autoComplete="current-password"
                      className="form-input"
                      style={{ paddingLeft: 38 }}
                      placeholder="••••••••"
                      value={employerPassword}
                      onChange={(e) => setEmployerPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Please wait...' : t('login_btn')}
                </button>
              </>
            )}
          </form>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button
              onClick={() => {
                setIsEmployerRegister(!isEmployerRegister);
                setEmailCodeSent(false);
                setEmailVerificationCode('123456');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
            >
              {isEmployerRegister ? 'Already registered? Sign In' : 'New employer? Register your company'}
            </button>
          </div>
        </div>
      )}

      {/* ================= TAB 3: ADMIN ================= */}
      {activeTab === 'admin' && (
        <div className="card">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>Admin System Login</h2>
          <form onSubmit={handleAdminAuth}>
            <div className="form-group">
              <label className="form-label">Admin Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  className="form-input"
                  style={{ paddingLeft: 38 }}
                  placeholder="admin@malajobs.mw"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  className="form-input"
                  style={{ paddingLeft: 38 }}
                  placeholder="admin123"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={submitting}>
              Enter Admin Portal
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default AuthPage;
