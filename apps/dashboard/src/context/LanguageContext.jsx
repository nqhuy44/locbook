import React, { createContext, useState, useContext, useEffect } from 'react';
import { vi } from '../locales/vi';
import { en } from '../locales/en';

const LanguageContext = createContext();

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }) => {
    // Default to 'vi' if not set
    const [language, setLanguage] = useState(() => {
        return localStorage.getItem('app_language') || 'vi';
    });

    useEffect(() => {
        localStorage.setItem('app_language', language);
    }, [language]);

    const translations = language === 'vi' ? vi : en;

    // Helper to get nested keys, e.g. t('nav.discover')
    const t = (key) => {
        const keys = key.split('.');
        let value = translations;
        for (const k of keys) {
            value = value?.[k];
            if (!value) return key; // Fallback to key if not found
        }
        return value;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};
