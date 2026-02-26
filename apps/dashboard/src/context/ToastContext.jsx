"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

const ToastContext = createContext();
export const useToast = () => useContext(ToastContext);

function Toast({ message, type = "info", duration = 3000, onClose }) {
    useEffect(() => {
        const timer = setTimeout(onClose, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const bgColors = {
        success: "linear-gradient(135deg, #10b981, #059669)",
        error: "linear-gradient(135deg, #ef4444, #dc2626)",
        info: "linear-gradient(135deg, #d946ef, #a855f7)",
    };

    return (
        <div
            style={{
                padding: "12px 20px",
                borderRadius: "12px",
                background: bgColors[type] || bgColors.info,
                color: "white",
                fontSize: "0.9rem",
                fontWeight: 500,
                boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                animation: "slideInRight 0.3s ease-out",
                cursor: "pointer",
            }}
            onClick={onClose}
        >
            {message}
        </div>
    );
}

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = "info", duration = 3000) => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type, duration }]);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div
                style={{
                    position: "fixed",
                    top: "20px",
                    right: "20px",
                    zIndex: 9999,
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                }}
            >
                {toasts.map((toast) => (
                    <Toast
                        key={toast.id}
                        message={toast.message}
                        type={toast.type}
                        duration={toast.duration}
                        onClose={() => removeToast(toast.id)}
                    />
                ))}
            </div>
        </ToastContext.Provider>
    );
};
