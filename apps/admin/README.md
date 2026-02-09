# LocBook Dashboard (Frontend)

This is the React + Vite frontend for LocBook, focused on displaying location data with a "Marin" (My Dress-Up Darling) inspired theme.

## Tech Stack
- **Framework**: React 18 + Vite
- **Styling**: Vanilla CSS (CSS Variables, Flexbox/Grid)
- **Icons**: Lucide React
- **Map Integration**: External links to Google Maps

## Setup & Run Locally

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Configuration**:
    - The app connects to the backend via `VITE_API_URL`.
    - Default: `http://localhost:8000`
    - To change: Create `.env` or set variable:
      ```bash
      VITE_API_URL=http://your-backend-api.com npm run dev
      ```

3.  **Run Dev Server**:
    ```bash
    npm run dev
    ```
    Access at `http://localhost:5173`.

## Docker Build

To build the production image (NGINX serving static files):

```bash
docker build -t nqh44/locbook-fe:latest .
```

## Features
- **Configurable**: Check `src/config.js` to toggle features (Footer, Buy Me Coffee, Discover Tab) and reorder Home Categories.
- **Responsive**: Mobile-friendly layout.
- **Dark Mode**: Default dark theme with purple/pink gradients.
