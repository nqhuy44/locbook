"use client";

import React, { createContext, useState, useContext, useEffect } from "react";
import { vi } from "@/locales/vi";
import { en } from "@/locales/en";

const LanguageContext = createContext();

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState("vi");

    useEffect(() => {
        const saved = localStorage.getItem("app_language");
        if (saved) setLanguage(saved);
    }, []);

    useEffect(() => {
        localStorage.setItem("app_language", language);
    }, [language]);

    const translations = language === "vi" ? vi : en;

    const t = (key) => {
        const keys = key.split(".");
        let value = translations;
        for (const k of keys) {
            value = value?.[k];
            if (!value) return key;
        }
        return value;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};
