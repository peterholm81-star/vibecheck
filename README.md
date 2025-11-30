# VibeCheck

A real-time nightlife activity tracker with an interactive heatmap showing where the action is happening.

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS
- **Maps:** Mapbox GL JS
- **Backend:** Supabase (PostgreSQL + Auth)
- **Charts:** Recharts

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_MAPBOX_TOKEN=your_mapbox_token  # Optional, has fallback
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

```bash
npm run build
```

Output is generated in the `dist/` folder.

---

## Deploying to Vercel

Follow these steps to deploy VibeCheck to Vercel:

### 1. Log in to Vercel

Go to [vercel.com](https://vercel.com) and log in with your GitHub account.

### 2. Import the Project

1. Click **"Add New..."** → **"Project"**
2. Find and select the **vibecheck** repository
3. Click **"Import"**

### 3. Configure Build Settings

Vercel auto-detects Vite, but verify these settings:

| Setting | Value |
|---------|-------|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

### 4. Add Environment Variables

In the **Environment Variables** section, add:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| `VITE_MAPBOX_TOKEN` | *(Optional)* Your Mapbox access token |

> **Note:** You can find your Supabase credentials in your Supabase dashboard under **Settings → API**.

### 5. Deploy

Click **"Deploy"** and wait for the build to complete.

Your app will be live at `https://vibecheck-<unique-id>.vercel.app`

### 6. (Optional) Custom Domain

After deployment, go to **Settings → Domains** to add a custom domain.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |

## License

MIT


