import React, { createContext, useContext, useState, useEffect } from 'react';
import en from '../i18n/en.json';
import ny from '../i18n/ny.json';

const LanguageContext = createContext();

const translations = { en, ny };

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('malajobs_lang') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('malajobs_lang', language);
  }, [language]);

  const t = (key) => {
    return translations[language]?.[key] || translations['en']?.[key] || key;
  };

  const toggleLanguage = () => {
    setLanguage(prev => (prev === 'en' ? 'ny' : 'en'));
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
