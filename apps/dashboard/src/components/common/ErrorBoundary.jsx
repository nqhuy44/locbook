import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div
          style={{
            height: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            textAlign: "center",
            background: "var(--bg-primary)",
            color: "var(--text-primary)",
            fontFamily: "Nunito, sans-serif",
          }}
        >
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🏗️</div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: "bold",
              marginBottom: "1rem",
              color: "#ef4444",
            }}
          >
            Đã xảy ra lỗi hệ thống
          </h1>
          <p
            style={{
              color: "var(--text-secondary)",
              marginBottom: "2rem",
              maxWidth: "400px",
            }}
          >
            Ứng dụng gặp sự cố không mong muốn. Điều này thường do lỗi đồng bộ
            giao diện trình duyệt.
          </p>

          <div
            style={{
              background: "rgba(0,0,0,0.05)",
              padding: "1rem",
              borderRadius: "12px",
              fontSize: "0.8rem",
              fontFamily: "monospace",
              marginBottom: "2rem",
              maxWidth: "100%",
              overflowX: "auto",
              textAlign: "left",
              color: "#666",
            }}
          >
            {this.state.error && this.state.error.toString()}
          </div>

          <button
            onClick={this.handleReload}
            style={{
              padding: "0.75rem 2rem",
              borderRadius: "25px",
              border: "none",
              background: "var(--accent-gradient)",
              color: "white",
              fontWeight: "bold",
              boxShadow: "0 10px 20px rgba(217, 70, 239, 0.3)",
              cursor: "pointer",
            }}
          >
            Tải lại ứng dụng
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
