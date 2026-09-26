import React, { useState } from 'react';
import { LanguageProvider } from './context/LanguageContext.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import Navbar from './components/Navbar.jsx';
import BottomNav from './components/BottomNav.jsx';
import NotificationDrawer from './components/NotificationDrawer.jsx';
import BoardPage from './pages/BoardPage.jsx';
import JobDetailPage from './pages/JobDetailPage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import ApplicationsPage from './pages/ApplicationsPage.jsx';
import EmployerDashboard from './pages/EmployerDashboard.jsx';
import PostJobPage from './pages/PostJobPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import CompanyProfilePage from './pages/CompanyProfilePage.jsx';

function MainApp() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('board');
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const handleSelectJob = (id) => { setSelectedCompanyId(null); setSelectedJobId(id); };
  const handleSelectCompany = (id) => { setSelectedJobId(null); setSelectedCompanyId(id); };
  const handleBackToBoard = () => { setSelectedJobId(null); setSelectedCompanyId(null); };
  const navigateTo = (tab) => { setSelectedJobId(null); setSelectedCompanyId(null); setActiveTab(tab); };

  const renderContent = () => {
    if (user?.role === 'admin') return <AdminPage />;

    if (selectedCompanyId) {
      return (
        <CompanyProfilePage
          companyId={selectedCompanyId}
          onBack={handleBackToBoard}
          onSelectJob={user?.role === 'job_seeker' ? handleSelectJob : undefined}
        />
      );
    }

    if (selectedJobId) {
      return (
        <JobDetailPage
          jobId={selectedJobId}
          onBack={handleBackToBoard}
          onSelectCompany={handleSelectCompany}
          onApplied={() => { setSelectedJobId(null); setActiveTab('applications'); }}
          onNavigateAuth={() => navigateTo('auth')}
        />
      );
    }

    if (user?.role === 'employer') {
      if (activeTab === 'post-job') {
        return <PostJobPage onBack={() => navigateTo('employer')} onJobPosted={() => navigateTo('employer')} />;
      }
      if (activeTab === 'board') {
        return <BoardPage onSelectJob={handleSelectJob} onSelectCompany={handleSelectCompany} />;
      }
      return <EmployerDashboard onNavigatePostJob={() => navigateTo('post-job')} />;
    }

    switch (activeTab) {
      case 'board': return <BoardPage onSelectJob={handleSelectJob} onSelectCompany={handleSelectCompany} />;
      case 'applications': return user ? <ApplicationsPage /> : <AuthPage onAuthenticated={() => navigateTo('board')} />;
      case 'profile': return user ? <ProfilePage /> : <AuthPage onAuthenticated={() => navigateTo('board')} />;
      case 'auth':
      default:
        return user ? <BoardPage onSelectJob={handleSelectJob} onSelectCompany={handleSelectCompany} /> : <AuthPage onAuthenticated={() => navigateTo('board')} />;
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="app-container">
      <Navbar onOpenNotifications={() => setIsNotificationsOpen(true)} />
      <main style={{ flex: 1 }}>{renderContent()}</main>
      <NotificationDrawer isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
      {!isAdmin && (
        <BottomNav
          activeTab={selectedJobId || selectedCompanyId ? 'board' : activeTab}
          setActiveTab={navigateTo}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <NotificationProvider>
          <MainApp />
        </NotificationProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
