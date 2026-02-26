"use client";
import React from "react";
import { Lock, Construction, Map, Plane } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const FeatureDisabledOverlay = ({ title, message, mode = "lock" }) => {
  const { t } = useLanguage();

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        background: "var(--bg-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div className="books-login-container">
        <div style={{ textAlign: "center", maxWidth: "400px" }}>
          <div className="login-icon-circle">
            {mode === "construction" ? (
              <Construction size={40} />
            ) : mode === "drawing" ? (
              <Map size={40} />
            ) : mode === "travel" ? (
              <Plane size={40} />
            ) : (
              <Lock size={40} />
            )}
          </div>
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: "bold",
              marginBottom: "0.5rem",
              color: "var(--text-primary)",
            }}
          >
            {title}
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              marginBottom: "2rem",
              lineHeight: 1.5,
            }}
          >
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}; // End of FeatureDisabledOverlay

export default FeatureDisabledOverlay;
