import React from "react";
import { BarChart, TrendingUp, Users, MapPin } from "lucide-react";

const AnalyticsPage = () => {
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
        <BarChart size={24} color="var(--accent-color)" />
        <h1 className="section-title">Analytics Dashboard</h1>
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
          <TrendingUp size={40} />
        </div>
        <h3 style={{ color: "var(--text-primary)", marginTop: 0 }}>
          Analytics Coming Soon
        </h3>
        <p
          style={{
            color: "var(--text-secondary)",
            maxWidth: "400px",
            margin: "0 auto",
          }}
        >
          We are building a comprehensive dashboard to track user engagement,
          place popularity, and system performance.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1.5rem",
          marginTop: "2rem",
          opacity: 0.5,
          pointerEvents: "none",
        }}
      >
        <div className="admin-card">
          <div style={{ color: "var(--text-tertiary)", fontSize: "0.9rem" }}>
            Total Users
          </div>
          <div
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            1,234
          </div>
        </div>
        <div className="admin-card">
          <div style={{ color: "var(--text-tertiary)", fontSize: "0.9rem" }}>
            Active Places
          </div>
          <div
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            567
          </div>
        </div>
        <div className="admin-card">
          <div style={{ color: "var(--text-tertiary)", fontSize: "0.9rem" }}>
            Daily Views
          </div>
          <div
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            8.9k
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
