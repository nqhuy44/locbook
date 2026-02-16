import { useState, useEffect } from "react";
import { Monitor, Smartphone, Server } from "lucide-react";

/**
 * SystemPage
 * Displays version information for backend, dashboard, and admin dashboard.
 */
const SystemPage = ({ API_URL }) => {
  const [versions, setVersions] = useState({
    backend: "...",
    dashboard: "...",
    admin_dashboard: "...",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVersions = async () => {
      const newVersions = {
        backend: "...",
        dashboard: "...",
        admin_dashboard: "...",
      };

      // 1. Backend
      try {
        const res = await fetch(`${API_URL}/api/versions`);
        if (res.ok) {
          const data = await res.json();
          newVersions.backend = data.backend || "unknown";
        } else {
          newVersions.backend = "error";
        }
      } catch (e) {
        console.error("Failed to fetch backend version", e);
        newVersions.backend = "error";
      }

      // 2. Admin Dashboard (Self)
      try {
        // Try from public file first
        const res = await fetch("/version.json");
        if (res.ok) {
          const data = await res.json();
          newVersions.admin_dashboard = data.version || "unknown";
        } else {
          newVersions.admin_dashboard = window.__APP_VERSION__ || "dev";
        }
      } catch (e) {
        newVersions.admin_dashboard = window.__APP_VERSION__ || "dev";
      }

      // 3. User Dashboard (Need Config first for URL)
      try {
        const configRes = await fetch(`${API_URL}/api/config`);
        if (configRes.ok) {
          const configData = await configRes.json();
          const dashboardUrl =
            configData.LINKS?.DASHBOARD_URL || configData.LINKS?.AUTHOR_WEBSITE;

          if (dashboardUrl) {
            try {
              // Ensure no trailing slash
              const cleanUrl = dashboardUrl.replace(/\/$/, "");
              const res = await fetch(`${cleanUrl}/version.json`);
              if (res.ok) {
                const data = await res.json();
                newVersions.dashboard = data.version || "unknown";
              } else {
                newVersions.dashboard = "unknown";
              }
            } catch (e) {
              console.error("Failed to fetch dashboard version", e);
              newVersions.dashboard = "error";
            }
          } else {
            newVersions.dashboard = "not configured";
          }
        }
      } catch (e) {
        console.error("Failed to fetch config for dashboard url", e);
        newVersions.dashboard = "-";
      }

      setVersions(newVersions);
      setLoading(false);
    };

    fetchVersions();
  }, [API_URL]);

  if (loading)
    return (
      <div
        style={{
          textAlign: "center",
          marginTop: "2rem",
          color: "var(--text-secondary)",
        }}
      >
        Checking system status...
      </div>
    );

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
        <Monitor size={24} color="var(--accent-color)" />
        <h1 className="section-title">System Status</h1>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "1.5rem",
        }}
      >
        <VersionCard
          title="Backend API"
          version={versions.backend}
          icon={Server}
          color="var(--accent-color-strong)"
          status={versions.backend !== "error" ? "healthy" : "error"}
        />
        <VersionCard
          title="User Dashboard"
          version={versions.dashboard}
          icon={Smartphone}
          color="var(--accent-color)"
          status={versions.dashboard !== "error" ? "healthy" : "warning"}
        />
        <VersionCard
          title="Admin Dashboard"
          version={versions.admin_dashboard}
          icon={Monitor}
          color="var(--text-primary)"
          status="healthy"
        />
      </div>

      <div className="admin-card" style={{ marginTop: "2rem" }}>
        <h3 style={{ marginTop: 0, color: "var(--text-primary)" }}>
          Environment Info
        </h3>
        <div
          style={{
            display: "grid",
            gap: "0.5rem",
            fontSize: "0.9rem",
            color: "var(--text-secondary)",
          }}
        >
          <div>
            API URL:{" "}
            <span
              style={{
                fontFamily: "monospace",
                background: "var(--bg-primary)",
                padding: "2px 6px",
                borderRadius: "4px",
              }}
            >
              {API_URL}
            </span>
          </div>
          <div>User Agent: {navigator.userAgent}</div>
        </div>
      </div>
    </div>
  );
};

const VersionCard = ({ title, version, icon: Icon, color, status }) => (
  <div
    className="admin-card"
    style={{
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "0.5rem",
      position: "relative",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "4px",
        background:
          status === "healthy"
            ? "#10b981"
            : status === "warning"
              ? "#f59e0b"
              : "#ef4444",
      }}
    />

    <div
      style={{
        background: "var(--bg-primary)",
        padding: "1rem",
        borderRadius: "50%",
        marginBottom: "0.5rem",
        color: color,
      }}
    >
      <Icon size={24} />
    </div>

    <div
      style={{
        fontSize: "0.95rem",
        fontWeight: 600,
        color: "var(--text-secondary)",
      }}
    >
      {title}
    </div>
    <div
      style={{
        fontSize: "1.8rem",
        fontWeight: 800,
        color: "var(--text-primary)",
      }}
    >
      {version}
    </div>
    <div
      style={{
        fontSize: "0.75rem",
        textTransform: "uppercase",
        letterSpacing: "1px",
        fontWeight: 700,
        color:
          status === "healthy"
            ? "#10b981"
            : status === "warning"
              ? "#f59e0b"
              : "#ef4444",
        marginTop: "0.2rem",
      }}
    >
      {status}
    </div>
  </div>
);

export default SystemPage;
