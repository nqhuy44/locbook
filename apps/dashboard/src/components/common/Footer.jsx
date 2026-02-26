"use client";
import React from "react";
import { Coffee, Github, Globe, MessageSquare } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const Footer = ({ config }) => {
  const { t } = useLanguage();

  return (
    <footer className="footer desktop-only">
      <div className="footer-content">
        <div className="footer-brand">Spotary</div>
        <div className="footer-links">
          {config.FEATURES.ENABLE_BUY_ME_COFFEE && (
            <a
              href={config.LINKS.BUY_ME_COFFEE}
              target="_blank"
              rel="noreferrer"
            >
              <Coffee size={18} /> {t("settings.coffee")}
            </a>
          )}
          {config.LINKS.GITHUB && (
            <a href={config.LINKS.GITHUB} target="_blank" rel="noreferrer">
              <Github size={18} /> GitHub
            </a>
          )}
          {config.LINKS.AUTHOR_WEBSITE && (
            <a
              href={config.LINKS.AUTHOR_WEBSITE}
              target="_blank"
              rel="noreferrer"
            >
              <Globe size={18} /> Website
            </a>
          )}
          {config.LINKS.FEEDBACK && (
            <a href={config.LINKS.FEEDBACK} target="_blank" rel="noreferrer">
              <MessageSquare size={18} /> {t("settings.feedback")}
            </a>
          )}
        </div>
        <div className="footer-text">Made by nqhuy</div>
        <div className="footer-copyright">
          © {new Date().getFullYear()} Spotary. All rights reserved. v
          {typeof process.env.NEXT_PUBLIC_APP_VERSION !== "undefined" ? process.env.NEXT_PUBLIC_APP_VERSION : "1.2.0"}
        </div>
      </div>
    </footer >
  );
};

export default Footer;
