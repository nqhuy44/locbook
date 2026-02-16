import { useState } from "react";
import { Lock, ArrowRight } from "lucide-react";

const LoginPage = ({ onLogin }) => {
  const [input, setInput] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(input);
  };

  return (
    <div
      className="app-container"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-primary)", // Use gradient background
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "white",
          padding: "2.5rem",
          borderRadius: "24px",
          boxShadow: "0 20px 50px -10px rgba(139, 92, 246, 0.15)",
          width: "100%",
          maxWidth: "400px",
          border: "1px solid rgba(255,255,255,0.5)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.5rem",
        }}
      >
        <div
          style={{
            background: "var(--accent-gradient)",
            padding: "1rem",
            borderRadius: "50%",
            color: "white",
            marginBottom: "0.5rem",
            boxShadow: "0 10px 20px -5px rgba(253, 112, 211, 0.4)",
          }}
        >
          <Lock size={32} />
        </div>

        <div style={{ textAlign: "center" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "1.8rem",
              fontWeight: 800,
              background: "var(--accent-gradient)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Admin Access
          </h2>
          <p
            style={{
              margin: "0.5rem 0 0",
              color: "var(--text-tertiary)",
              fontSize: "0.9rem",
            }}
          >
            Please enter your secure token to continue.
          </p>
        </div>

        <div style={{ width: "100%" }}>
          <input
            type="password"
            placeholder="Enter Admin Token"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            style={{
              width: "100%",
              padding: "1rem",
              borderRadius: "12px",
              background: "var(--bg-primary)",
              border: "1px solid var(--border-color)",
              fontSize: "1rem",
              outline: "none",
              color: "var(--text-primary)",
              transition: "all 0.2s",
              textAlign: "center",
            }}
            onFocus={(e) =>
              (e.target.style.borderColor = "var(--accent-color)")
            }
            onBlur={(e) => (e.target.style.borderColor = "var(--border-color)")}
          />
        </div>

        <button
          type="submit"
          className="bmc-button"
          style={{
            width: "100%",
            justifyContent: "center",
            padding: "1rem",
            fontSize: "1rem",
            marginTop: "0.5rem",
          }}
        >
          Access Dashboard <ArrowRight size={18} />
        </button>
      </form>

      <div
        style={{
          position: "absolute",
          bottom: "2rem",
          color: "var(--text-tertiary)",
          fontSize: "0.8rem",
          opacity: 0.7,
        }}
      >
        &copy; {new Date().getFullYear()} LocBook Admin
      </div>
    </div>
  );
};

export default LoginPage;
