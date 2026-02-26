"use client";

import dynamic from "next/dynamic";

// Dynamic import to avoid SSR issues with browser APIs (localStorage, window, etc.)
const AppContent = dynamic(() => import("@/components/AppContent"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        color: "white",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1a1a2e",
      }}
    >
      Loading...
    </div>
  ),
});

export default function Home() {
  return <AppContent />;
}
