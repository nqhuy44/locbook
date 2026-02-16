import { useState, useEffect } from "react";
import AdminLayout from "./layouts/AdminLayout";
import LoginPage from "./pages/LoginPage";
import PlacesPage from "./pages/PlacesPage";
import ConfigPage from "./pages/ConfigPage";
import SystemPage from "./pages/SystemPage";
import MarinPage from "./pages/MarinPage";
import UsersPage from "./pages/UsersPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import MemosPage from "./pages/MemosPage";

const API_URL = import.meta.env.VITE_API_URL || "";

function App() {
  const [token, setToken] = useState(localStorage.getItem("adminToken") || "");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [view, setView] = useState("analytics"); // Default view

  useEffect(() => {
    if (token) {
      setIsAuthenticated(true);
    }
  }, [token]);

  const handleLogin = (inputToken) => {
    if (inputToken.trim()) {
      localStorage.setItem("adminToken", inputToken);
      setToken(inputToken);
      setIsAuthenticated(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setToken("");
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <AdminLayout view={view} setView={setView} onLogout={handleLogout}>
      {view === "places" && <PlacesPage API_URL={API_URL} token={token} />}
      {view === "config" && <ConfigPage API_URL={API_URL} token={token} />}
      {view === "system" && <SystemPage API_URL={API_URL} />}
      {view === "marin" && <MarinPage API_URL={API_URL} token={token} />}
      {view === "users" && <UsersPage API_URL={API_URL} token={token} />}
      {view === "analytics" && <AnalyticsPage />}
      {view === "memos" && <MemosPage />}
    </AdminLayout>
  );
}

export default App;
