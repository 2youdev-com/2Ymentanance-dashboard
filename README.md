# 2Ymentanance — Web Dashboard

React.js + Vite + TypeScript + TailwindCSS + shadcn/ui

## Quick Start

```bash
npm install
npm run dev
# Opens at http://localhost:5173
```

## Requirements

Backend API must be running at `http://localhost:3000`
See `../loc-backend/README.md`

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/login` | Login | JWT authentication |
| `/` | Dashboard | KPI cards + live activity feed |
| `/assets` | Asset Registry | Search, filter, paginated table |
| `/assets/:id` | Asset Detail | Full info + maintenance history + media |
| `/maintenance` | Maintenance Log | All maintenance records with filters |
| `/reports` | Problem Reports | All problem reports with resolve action |
| `/map` | Site Map | CesiumJS 3D map with asset pins |
| `/users` | Users (Admin) | User management CRUD |

## Tech Stack

- **Framework**: React 18 + Vite 5
- **Language**: TypeScript 5
- **Styling**: TailwindCSS 3 + shadcn/ui components
- **State**: Zustand (auth + site selector + activity feed)
- **API**: Axios with JWT interceptor
- **Real-time**: Socket.io client (live activity feed)
- **Map**: CesiumJS (loaded from CDN)
- **Media**: react-player (video), HTML5 audio
- **Routing**: React Router v6

## Demo Credentials

| Username | Password | Role |
|----------|----------|------|
| supervisor | demo1234 | Admin |
| tech1 | demo1234 | Technician |
| viewer | demo1234 | Viewer |

## Deploy to Vercel

```bash
npm run build
# deploy dist/ folder to Vercel
# set VITE_API_URL env var if backend is on a different domain
```
