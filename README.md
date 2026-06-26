# 🔥 Forge Mail

A self-hosted email sender with a dark, premium UI. Built with a **NestJS** backend and a **Vanilla JS** frontend. Supports **Resend** and **Gmail (OAuth2)** as email providers.

---

## 🏗️ Project Structure

```
mailApp/
├── Dockerfile                         # Multi-stage production build (root)
├── .dockerignore
├── .gitignore
├── docker-compose.yml                 # Local development
├── docker-compose.prod.yml            # Production
├── README.md
├── .github/
│   └── workflows/
│       └── docker-publish.yml         # CI/CD: build → GHCR → deploy
├── backend/               # NestJS API + static file server
│   ├── src/
│   │   ├── mail/          # Mail module (controller, service, DTOs)
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── .env.example       # Copy to .env and fill in secrets
│   └── package.json
└── frontend/              # Static HTML/CSS/JS (served by NestJS)
    ├── index.html
    ├── style.css
    └── app.js
```

---

## ⚡ Quick Start (Local)

### Option A — Node.js (no Docker)

```bash
cd backend
cp .env.example .env
# Edit .env and fill in your API keys
npm install
npm run start:dev
# App runs at http://localhost:3000
```

### Option B — Docker Compose

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your real values
docker-compose up --build
# App runs at http://localhost:3000
```

---

## 🔑 Environment Variables

Copy `backend/.env.example` → `backend/.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | HTTP port (default: `3000`) |
| `RESEND_API_KEY` | Yes | Your [Resend](https://resend.com) API key |
| `DEFAULT_FROM` | Yes | Default sender address (must be verified in Resend) |
| `GOOGLE_CLIENT_ID` | For Gmail | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | For Gmail | Google OAuth2 client secret |
| `CORS_ORIGIN` | Prod only | Comma-separated allowed origins (e.g. `https://yourapp.back4app.io`) |
| `NODE_ENV` | No | Set to `production` in prod |

---

## 🐳 Docker

### Build image manually

```bash
docker build -t forge-mail .
```

### Run container

```bash
docker run -p 3000:3000 \
  -e RESEND_API_KEY=re_xxx \
  -e DEFAULT_FROM=hello@yourdomain.com \
  -e NODE_ENV=production \
  forge-mail
```

---

## 🚀 Deploying to BaaS

### 1. Back4App Containers

1. Push your repo to GitHub.
2. Go to [Back4App](https://www.back4app.com/) → **Create new app** → **Containers**.
3. Connect your GitHub repo. Back4App will detect the `Dockerfile` at the repo root.
4. Add environment variables in the Back4App dashboard (same as the table above).
5. Deploy — Back4App will build and run the container.

**CI/CD (automatic deploys):**
Add these secrets to your GitHub repo (`Settings → Secrets`):
- `BACK4APP_APP_ID` — found in Back4App app settings
- `BACK4APP_API_KEY` — your Back4App REST API key

Every push to `main` will auto-deploy.

---

### 2. Supabase (via Fly.io / Railway side-car)

Supabase itself is a Postgres + Auth BaaS and does **not** run arbitrary containers. To use Supabase **alongside** Forge Mail:

1. Deploy the container to [Railway](https://railway.app) or [Fly.io](https://fly.io):

   ```bash
   # Railway (one-click)
   railway up
   ```

2. Set all env vars in Railway/Fly dashboard.
3. Use Supabase for future database or auth needs by adding the Supabase client SDK to the backend.

---

### 3. Nhost (app.nhost.io)

Nhost runs on [Hasura](https://hasura.io) + Postgres + Auth. For custom containers:

1. Use **Nhost Run** (container service):
   - Go to your Nhost project → **Run** → **New Service**.
   - Point to your GitHub repo.
   - Set the Dockerfile path: `backend/Dockerfile`.
   - Add environment variables.
   - Deploy.

2. Nhost will give you a public URL like `https://forge-mail.svc.nhost.run`.

---

## 🔄 GitHub Actions CI/CD

The workflow at `.github/workflows/docker-publish.yml`:

| Trigger | Action |
|---|---|
| Push to `main` | Build image → push to **GHCR** (`ghcr.io/<you>/forge-mail:latest`) |
| Tag `v*.*.*` | Also tag image with semantic version |
| Pull Request | Build only (no push) |
| Push to `main` + `BACK4APP_APP_ID` set | Also triggers Back4App deploy |

### Required GitHub Secrets

Go to **Settings → Secrets and variables → Actions**:

| Secret | Description |
|---|---|
| `BACK4APP_APP_ID` | (Optional) Back4App App ID |
| `BACK4APP_API_KEY` | (Optional) Back4App REST API Key |

`GITHUB_TOKEN` is auto-provided — no setup needed for GHCR.

---

## 🛠️ Development Scripts

```bash
# From backend/
npm run start:dev    # Watch mode
npm run build        # Compile TypeScript
npm run start:prod   # Run compiled output
npm run test         # Unit tests
npm run lint         # ESLint
```

---

## 📄 License

MIT
