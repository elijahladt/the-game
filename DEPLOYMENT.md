# 🌐 QUICKFIRE — Vercel & Multiplayer Deployment Guide

This guide details how to deploy the Quickfire frontend on **Vercel** and connect it to the authoritative multiplayer backend.

---

## ⚡ Architecture Overview

- **Frontend (Client)**: React 19 + TypeScript + Vite + Tailwind CSS. Hosted statically on **Vercel**.
- **Backend (Server)**: Node.js + Express + Socket.IO. Requires persistent WebSocket connections, hosted on **Railway**, **Render**, or **Fly.io** (or any Node.js container/VPS).
- **Database (Optional)**: Supabase PostgreSQL (or built-in local in-memory fallback).

---

## 🚀 Part 1: Deploying Frontend to Vercel

### Option A: Using the Vercel Dashboard (Recommended)

1. Push your repository to **GitHub** / **GitLab** / **Bitbucket**.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. In **Project Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./` (leave default, the included root `vercel.json` automatically configures Vite build output to `client/dist`)
   - **Build Command**: `npm run build`
   - **Output Directory**: `client/dist`
4. In **Environment Variables**, add:
   ```env
   VITE_SERVER_URL=https://your-backend-domain.up.railway.app
   ```
   *(If you haven't deployed the backend yet, you can leave it blank and configure it later or directly in the game UI!)*
5. Click **Deploy**.

### Option B: Using the Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from repository root
vercel
```

---

## 🖥️ Part 2: Deploying the Authoritative Multiplayer Server

The multiplayer server requires persistent WebSocket connections (Socket.IO). Deploy it for free or low cost on Railway or Render:

### Deploy on Railway

1. Go to [railway.app](https://railway.app) and create a new project.
2. Select **Deploy from GitHub repo**.
3. Railway automatically detects the root `Dockerfile` and builds the Node.js server.
4. In **Settings > Networking**, click **Generate Domain** (e.g. `quickfire-server.up.railway.app`).
5. (Optional) In **Variables**, add:
   ```env
   PORT=3001
   CLIENT_URL=https://your-quickfire-app.vercel.app
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   ```
6. Copy your generated domain URL (e.g. `https://quickfire-server.up.railway.app`).

### Deploy on Render

1. Go to [render.com](https://render.com) and click **New + > Web Service**.
2. Connect your repository.
3. Configure:
   - **Environment**: `Docker` (using the root `Dockerfile`) or `Node`
   - **Build Command**: `npm install && npm run build --workspace=@quickfire/shared && npm run build --workspace=@quickfire/server`
   - **Start Command**: `node server/dist/index.js`
4. Add environment variables:
   ```env
   PORT=3001
   CLIENT_URL=https://your-quickfire-app.vercel.app
   ```
5. Render will provide a public URL (e.g. `https://quickfire-backend.onrender.com`).

---

## 🔗 Part 3: Connecting Frontend and Backend

Once your backend is live:

1. **In Vercel**:
   Go to your project's **Settings > Environment Variables**, set `VITE_SERVER_URL` to your backend URL, and click **Redeploy**.

2. **In the Game UI**:
   Players can also click the **CONNECT / ONLINE** pill in the top navigation bar at any time to enter a custom backend URL without needing to redeploy! The app will save the URL and reconnect immediately.

---

## 📊 Part 4: Supabase Database Setup (Optional)

QUICKFIRE includes a built-in question bank and in-memory store so it works immediately without external services.

To persist matches and custom questions to Supabase PostgreSQL:
1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in Supabase and run [`database/schema.sql`](file:///c:/Users/elija/Downloads/geeg/database/schema.sql).
3. Run [`database/seed.sql`](file:///c:/Users/elija/Downloads/geeg/database/seed.sql) to insert curated questions.
4. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to your backend environment variables.
