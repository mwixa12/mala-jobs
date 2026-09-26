import React from 'react';
import { Briefcase, FileText, User, PlusCircle, ShieldCheck, LogIn } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export function BottomNav({ activeTab, setActiveTab }) {
  const { t } = useLanguage();
  const { user } = useAuth();

  return (
    <nav className="bottom-nav">
      {/* Board Tab */}
      <button
        className={`nav-item ${activeTab === 'board' ? 'active' : ''}`}
        onClick={() => setActiveTab('board')}
      >
        <Briefcase size={20} />
        <span>{t('nav_board')}</span>
      </button>

      {/* Seeker Applications Tab OR Employer Post Tab */}
      {user?.role === 'job_seeker' && (
        <button
          className={`nav-item ${activeTab === 'applications' ? 'active' : ''}`}
          onClick={() => setActiveTab('applications')}
        >
          <FileText size={20} />
          <span>{t('nav_applications')}</span>
        </button>
      )}

      {user?.role === 'employer' && (
        <button
          className={`nav-item ${activeTab === 'employer' ? 'active' : ''}`}
          onClick={() => setActiveTab('employer')}
        >
          <PlusCircle size={20} />
          <span>{t('nav_employer')}</span>
        </button>
      )}

      {/* Profile / Auth Tab */}
      {user ? (
        <button
          className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <User size={20} />
          <span>{t('nav_profile')}</span>
        </button>
      ) : (
        <button
          className={`nav-item ${activeTab === 'auth' ? 'active' : ''}`}
          onClick={() => setActiveTab('auth')}
        >
          <LogIn size={20} />
          <span>{t('nav_login')}</span>
        </button>
      )}

      {/* Admin Tab (Visible for admin or easy toggle) */}
      {(user?.role === 'admin' || !user) && (
        <button
          className={`nav-item ${activeTab === 'admin' ? 'active' : ''}`}
          onClick={() => setActiveTab('admin')}
        >
          <ShieldCheck size={20} />
          <span>{t('nav_admin')}</span>
        </button>
      )}
    </nav>
  );
}

export default BottomNav;
