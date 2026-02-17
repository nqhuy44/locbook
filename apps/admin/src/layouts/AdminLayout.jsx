import {
  MapPin,
  Settings as SettingsIcon,
  Monitor,
  Sparkles,
  LogOut,
  BarChart,
  User,
  FileText,
} from "lucide-react";
import { useEffect } from "react";

const AdminLayout = ({ children, view, setView, onLogout }) => {
  // Scroll to top on view change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  const NavItem = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => setView(id)}
      className={`nav-link ${view === id ? "active" : ""}`}
      style={{
        width: "100%",
        justifyContent: "flex-start",
        background: view === id ? "var(--bg-secondary)" : "transparent",
      }}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );

  const MobileNavItem = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => setView(id)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
        background: "transparent",
        border: "none",
        color: view === id ? "var(--accent-color)" : "var(--text-tertiary)",
        padding: "0.5rem",
        flex: 1,
      }}
    >
      <Icon size={24} strokeWidth={view === id ? 2.5 : 2} />
      <span style={{ fontSize: "0.7rem", fontWeight: view === id ? 700 : 500 }}>
        {label}
      </span>
    </button>
  );

  return (
    <div
      className="app-container admin-layout"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Desktop Sidebar */}
      <aside className="admin-sidebar">
        <div
          className="brand"
          style={{
            marginBottom: "3rem",
            fontSize: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.8rem",
          }}
        >
          <img
            src="/pwa-dark-192x192x.png"
            alt="Logo"
            style={{ width: "40px", height: "40px", borderRadius: "8px" }}
          />
          <div
            style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}
          >
            <span>Spotary</span>
            <span
              style={{
                fontSize: "0.7rem",
                color: "var(--text-tertiary)",
                fontWeight: 600,
                letterSpacing: "1px",
                textTransform: "uppercase",
                marginTop: "2px",
              }}
            >
              Admin
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: "0.75rem",
              textTransform: "uppercase",
              color: "var(--text-tertiary)",
              fontWeight: 700,
              letterSpacing: "1px",
              marginBottom: "0.5rem",
            }}
          >
            Main
          </div>
          <NavItem id="analytics" icon={BarChart} label="Analytics" />
          <NavItem id="places" icon={MapPin} label="Places" />
          <NavItem id="users" icon={User} label="Users" />
          <NavItem id="memos" icon={FileText} label="Memos" />

          <div
            style={{
              fontSize: "0.75rem",
              textTransform: "uppercase",
              color: "var(--text-tertiary)",
              fontWeight: 700,
              letterSpacing: "1px",
              marginBottom: "0.5rem",
              marginTop: "2rem",
            }}
          >
            System
          </div>
          <NavItem id="config" icon={SettingsIcon} label="Configuration" />
          <NavItem id="marin" icon={Sparkles} label="Marin AI" />
          <NavItem id="system" icon={Monitor} label="System" />
        </div>

        <button
          onClick={onLogout}
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: "0.8rem",
            background: "transparent",
            border: "1px solid var(--border-color)",
            padding: "0.8rem",
            borderRadius: "12px",
            color: "#ef4444",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          <LogOut size={18} /> Logout
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Mobile Header (Only visible on small screens due to d-md-none check in standard classes or media query) */}
        {/* We can use inline style with media query check logic or just a class if we had utility classes */}
        <div
          className="mobile-header"
          style={{
            display: "none", // Default hidden
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "2rem",
          }}
        >
          {/* Using a style tag for this specific element to handle its display property cleanly without external css if desired,
                 but let's use the media query in index.css to toggle a class .mobile-header-visible
             */}
          <style>{`
                @media (max-width: 768px) {
                    .mobile-header { display: flex !important; }
                }
             `}</style>

          <div
            className="brand"
            style={{
              fontSize: "1.3rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <img
              src="/pwa-dark-192x192x.png"
              alt="Logo"
              style={{ width: "32px", height: "32px", borderRadius: "6px" }}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                lineHeight: 1,
              }}
            >
              <span>Spotary</span>
              <span
                style={{
                  fontSize: "0.6rem",
                  color: "var(--text-tertiary)",
                  fontWeight: 600,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                }}
              >
                Admin
              </span>
            </div>
          </div>
          <button
            onClick={onLogout}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--text-tertiary)",
            }}
          >
            <LogOut size={20} />
          </button>
        </div>

        <div
          style={{
            display: "none", // handled by logic below
          }}
          className="mobile-title"
        >
          <style>{`
                @media (max-width: 768px) {
                    .mobile-title { display: block !important; margin-bottom: 1.5rem; }
                }
             `}</style>
          <h1
            style={{
              fontSize: "1.8rem",
              fontWeight: 800,
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            {view.charAt(0).toUpperCase() + view.slice(1)}
          </h1>
        </div>

        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="admin-bottom-nav">
        <MobileNavItem id="analytics" icon={BarChart} label="Dash" />
        <MobileNavItem id="places" icon={MapPin} label="Places" />
        <MobileNavItem id="users" icon={User} label="Users" />
        <MobileNavItem id="config" icon={SettingsIcon} label="Config" />
        <MobileNavItem id="marin" icon={Sparkles} label="AI" />
      </nav>
    </div>
  );
};

export default AdminLayout;
