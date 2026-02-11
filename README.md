# LocBook Monorepo

This repository is managed as an Nx monorepo.

## Structure

- `apps/api`: Python FastAPI backend.
- `apps/dashboard`: User-facing React dashboard.
- `apps/admin`: Admin React dashboard.

## Commands

Requires `nx` (install via `npm install -g nx` or use `npx nx`).

### Development
- **Install dependencies**: `npm install`
- **Setup API**: `nx run api:install`
- **Start API**: `nx serve api`
- **Start Dashboard**: `nx serve dashboard`
- **Start Admin**: `nx serve admin`

### Building

- **Build Dashboard**: `nx build dashboard`
- **Build Admin**: `nx build admin`
- **Build API Docker Image**: `nx run api:build-image`

### Testing

- **API Tests**: `nx test api`
