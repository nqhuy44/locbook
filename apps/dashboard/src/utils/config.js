export const getApiUrl = () => {
    // Priority: Env Var > Dynamic Hostname
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;

    // Default: Assume backend runs on same host, port 8000
    const hostname = window.location.hostname;
    const protocol = window.location.protocol; // http:
    return `${protocol}//${hostname}:8000`;
};

export const API_URL = getApiUrl();
