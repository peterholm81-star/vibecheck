# VibeCheck

A real-time nightlife activity tracker with an interactive heatmap showing where the action is happening.

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS
- **Maps:** Mapbox GL JS
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions)
- **Charts:** Recharts
- **Hosting:** Vercel (Edge Functions for API)

---

## Getting Started (Local Development)

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file in the project root with these **frontend** variables:

```env
# Required - Supabase connection
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional - Mapbox (app has fallback token)
VITE_MAPBOX_TOKEN=pk.your-mapbox-token
```

> **Note:** Find your Supabase credentials in: Supabase Dashboard → Settings → API

### Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

Output is generated in the `dist/` folder.

---

## Environment Variables Reference

### Frontend Variables (VITE_* prefix)

These are bundled into the client-side code:

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `VITE_MAPBOX_TOKEN` | No | Mapbox access token (has fallback) |

### Server-Side Variables (Vercel Edge Functions)

These must be set in **Vercel Dashboard → Settings → Environment Variables**.  
⚠️ Do NOT prefix with `VITE_` (that exposes them to the client!)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (bypasses RLS) |
| `ADMIN_DASHBOARD_PIN` | Yes | 4-digit PIN for `/admin` access |
| `INSIGHTS_DASHBOARD_PIN` | Yes | 4-digit PIN for `/insights` access |
| `VIBECHECK_STAGE_BASIC_AUTH_ENABLED` | No | Set to `true` to enable staging auth |
| `VIBECHECK_STAGE_BASIC_AUTH_USER` | No | Basic auth username for staging |
| `VIBECHECK_STAGE_BASIC_AUTH_PASS` | No | Basic auth password for staging |

---

## Protected Routes: Admin & Insights

### How PIN Authentication Works

VibeCheck has two protected dashboards:

1. **`/admin`** - System administration (user stats, venue refresh)
2. **`/insights`** - Venue partner analytics dashboard

Both use server-side PIN validation:

```
User enters 4-digit PIN → Frontend sends PIN via header → 
API validates against env variable → Access granted/denied
```

### Where PINs Are Validated

| Dashboard | Frontend Component | API Endpoint | Environment Variable |
|-----------|-------------------|--------------|---------------------|
| `/admin` | `src/apps/AdminApp.tsx` | `/api/admin-stats` | `ADMIN_DASHBOARD_PIN` |
| `/insights` | `src/apps/InsightsApp.tsx` | `/api/insights-stats` | `INSIGHTS_DASHBOARD_PIN` |

### Changing PINs

To change the admin or insights PIN:

1. Go to **Vercel Dashboard → Project → Settings → Environment Variables**
2. Update `ADMIN_DASHBOARD_PIN` or `INSIGHTS_DASHBOARD_PIN`
3. Redeploy the project

> **Security:** PINs are NEVER exposed to the client. They are only stored server-side in Vercel environment variables and validated in Edge Functions.

---

## Project Structure

```
vibecheck/
├── api/                        # Vercel Edge Functions (server-side)
│   ├── admin-stats.ts          # Admin stats + PIN validation
│   ├── admin-refresh-all-cities.ts
│   └── insights-stats.ts       # Insights stats + PIN validation
├── src/
│   ├── apps/                   # PIN-gated app shells
│   │   ├── AdminApp.tsx        # Admin PIN gate + dashboard
│   │   └── InsightsApp.tsx     # Insights PIN gate + dashboard
│   ├── pages/
│   │   ├── AdminDashboard.tsx  # Admin dashboard content
│   │   └── InsightsDashboard.tsx # Insights dashboard content
│   ├── components/             # Reusable UI components
│   ├── lib/
│   │   └── supabase.ts         # Supabase client
│   └── ...
├── supabase/
│   ├── functions/              # Supabase Edge Functions
│   │   ├── fetch_venues_for_city/
│   │   └── get_venues_for_city/
│   └── migrations/             # Database migrations
└── middleware.ts               # Vercel middleware (staging auth)
```

---

## Deploying to Vercel

### 1. Import Project

1. Go to [vercel.com](https://vercel.com) and log in
2. Click **"Add New..."** → **"Project"**
3. Select the **vibecheck** repository
4. Click **"Import"**

### 2. Configure Build Settings

Vercel auto-detects Vite:

| Setting | Value |
|---------|-------|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

### 3. Add Environment Variables

In **Environment Variables**, add ALL required variables:

**Frontend (for all environments):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_MAPBOX_TOKEN` (optional)

**Server-side (for all environments):**
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_DASHBOARD_PIN`
- `INSIGHTS_DASHBOARD_PIN`

**Staging only (Preview environment):**
- `VIBECHECK_STAGE_BASIC_AUTH_ENABLED=true`
- `VIBECHECK_STAGE_BASIC_AUTH_USER`
- `VIBECHECK_STAGE_BASIC_AUTH_PASS`

### 4. Deploy

Click **"Deploy"** and wait for the build to complete.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run update:venues:google` | Update venues from Google Places |
| `npm run seed:demo` | Seed demo data |

---

## Supabase Edge Functions

The project uses two types of Edge Functions:

### Supabase-hosted (in `supabase/functions/`)

- `fetch_venues_for_city` - Fetches venues from OpenStreetMap
- `get_venues_for_city` - Returns venues for a city

### Vercel-hosted (in `api/`)

- `admin-stats.ts` - Admin dashboard statistics
- `admin-refresh-all-cities.ts` - Batch venue refresh
- `insights-stats.ts` - Insights dashboard statistics

---

## License

MIT


