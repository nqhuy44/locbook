import React from "react";
import { List, FileText } from "lucide-react";

/**
 * MemosPage
 * Placeholder similar to AnalyticsPage
 */
const MemosPage = () => {
  return (
    <div className="section-wrapper">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.8rem",
          marginBottom: "2rem",
        }}
      >
        <FileText size={24} color="var(--accent-color)" />
        <h1 className="section-title">Memos Management</h1>
      </div>

      <div
        className="admin-card"
        style={{ textAlign: "center", padding: "4rem 2rem" }}
      >
        <div
          style={{
            background: "var(--bg-primary)",
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.5rem",
            color: "var(--text-tertiary)",
          }}
        >
          <List size={40} />
        </div>
        <h3 style={{ color: "var(--text-primary)", marginTop: 0 }}>
          Memos System
        </h3>
        <p
          style={{
            color: "var(--text-secondary)",
            maxWidth: "400px",
            margin: "0 auto",
          }}
        >
          A secure way to manage system memos and announcements will be
          available here.
        </p>
      </div>
    </div>
  );
};

export default MemosPage;
