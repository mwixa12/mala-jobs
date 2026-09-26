import React, { useState } from 'react';
import { Bell, Globe, User, LogOut, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';

export function Navbar({ onOpenNotifications }) {
  const { language, toggleLanguage, t } = useLanguage();
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();

  return (
    <header className="top-header">
      <div className="brand">
        <div className="brand-icon">M</div>
        <span>MalaJobs</span>
      </div>

      <div className="header-actions">
        {/* Language Toggle */}
        <button className="lang-btn" onClick={toggleLanguage} title="Switch Language">
          <Globe size={14} style={{ display: 'inline', marginRight: 4 }} />
          {language === 'en' ? 'Chichewa' : 'English'}
        </button>

        {/* Notifications Bell */}
        {user && (
          <button className="bell-btn" onClick={onOpenNotifications} title="Notifications">
            <Bell size={20} />
            {unreadCount > 0 && <span className="badge-unread">{unreadCount}</span>}
          </button>
        )}

        {/* User Info / Logout */}
        {user ? (
          <button className="lang-btn" onClick={logout} title="Sign Out">
            <LogOut size={14} style={{ display: 'inline', marginRight: 4 }} />
            {user.role === 'admin' ? 'Admin' : user.role === 'employer' ? 'Employer' : 'Seeker'}
          </button>
        ) : null}
      </div>
    </header>
  );
}

export default Navbar;
