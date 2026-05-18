# ItsNotTechy Careers

A hiring management portal — job postings, applicant tracking, referrals,
interview scheduling, and promotion workflows. Built on Next.js 14, Prisma,
PostgreSQL, and NextAuth.

This README covers **Phase 1**: scaffold, authentication, dashboards, file
upload, seed, and deploy. Job posting, ATS, referrals, interviews, and
promotions are added in later phases per the plans in `docs/superpowers/plans/`.

---

## Local development

### Prerequisites
- Node.js 20 LTS (`node -v`)
- npm 10+
- Docker Desktop (for Postgres)

### Setup

```bash
git clone <repo-url> careeritsnottechy
cd careeritsnottechy
npm install
cp .env.example .env
# Edit .env:
#   - NEXTAUTH_SECRET=$(openssl rand -base64 32)
#   - SMTP_PASS=<your Hostinger mailbox password>
docker compose up -d postgres
npx prisma migrate dev
npm run seed
npm run dev
```

Open http://localhost:3000.

**Note on Postgres port:** docker-compose maps host **5433** → container 5432 so it doesn't clash with any other local Postgres on 5432. `.env.example` already uses 5433 in the connection strings.

### Seed accounts

| Role          | Email                                | Password        |
|---------------|--------------------------------------|-----------------|
| Super Admin   | from `.env` `SEED_ADMIN_EMAIL`       | from `.env`     |
| HR Manager    | hr@itsnottechy.com                   | HRpassword!1    |
| Manager       | manager@itsnottechy.com              | Mgrpassword!1   |
| Employee      | sam@itsnottechy.com                  | Emppassword!1   |
| Employee      | taylor@itsnottechy.com               | Emppassword!1   |
| Candidate     | alice.candidate@example.com          | CandPass!12     |
| Candidate     | ben.candidate@example.com            | CandPass!12     |

Change all seed passwords before deploying to anything externally reachable.

### Common commands

| Command              | What it does                                   |
|----------------------|------------------------------------------------|
| `npm run dev`        | Start Next.js dev server on port 3000          |
| `npm run build`      | Production build                               |
| `npm start`          | Run the production build                       |
| `npm test`           | Run the Vitest suite                           |
| `npm run lint`       | ESLint                                         |
| `npm run seed`       | (Re)seed the database — idempotent             |
| `npx prisma studio`  | Open Prisma Studio at http://localhost:5555    |
| `npx prisma migrate dev --name <change>` | Author a new migration         |

### Email in dev

By default, `.env` has `EMAIL_TEST_MODE=true` — emails are logged to the
`EmailLog` table and printed to the console, never sent. Set
`EMAIL_TEST_MODE=false` and provide real `SMTP_*` credentials to send for
real.

---

## Production deploy (Ubuntu 22.04 VPS)

The target domain is `career.itsnottechy.com`. Adjust as needed.

### 1. Server prerequisites

```bash
# As a sudo user on the VPS
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential nginx ufw

# Node 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL 16
sudo apt install -y postgresql postgresql-contrib

# PM2
sudo npm i -g pm2

# Firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 2. Create the database and DB user

```bash
sudo -u postgres psql <<'SQL'
CREATE USER careers WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
CREATE DATABASE careers OWNER careers;
SQL
```

### 3. Clone and configure

```bash
sudo mkdir -p /opt/itsnottechy-careers
sudo chown $USER:$USER /opt/itsnottechy-careers
cd /opt/itsnottechy-careers
git clone <repo-url> .
npm ci
cp .env.example .env
```

Edit `.env` (production uses **port 5432** since Postgres is native, not Docker):
- `DATABASE_URL=postgresql://careers:CHANGE_ME_STRONG_PASSWORD@localhost:5432/careers?schema=public`
- `NEXTAUTH_URL=https://career.itsnottechy.com`
- `NEXTAUTH_SECRET=` (run `openssl rand -base64 32`)
- `SMTP_PASS=` (real Hostinger mailbox password)
- `EMAIL_TEST_MODE=false`
- `STORAGE_ROOT=/var/itsnottechy/uploads`
- `APP_URL=https://career.itsnottechy.com`
- `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` — set the first admin you want to create.

Lock down `.env`:
```bash
chmod 600 .env
```

### 4. Migrate, seed, build

```bash
sudo mkdir -p /var/itsnottechy/uploads
sudo chown $USER:$USER /var/itsnottechy/uploads

npx prisma migrate deploy
npm run seed       # creates the Super Admin and sample staff/candidates
npm run build
```

### 5. Start with PM2

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup systemd      # follow the printed instruction once
```

`pm2 status` should show `itsnottechy-careers` online.

### 6. Nginx reverse proxy

Create `/etc/nginx/sites-available/career.itsnottechy.com`:

```nginx
server {
    listen 80;
    server_name career.itsnottechy.com;

    client_max_body_size 6M;   # leaves headroom over the app's 5MB upload limit

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/career.itsnottechy.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Confirm `http://career.itsnottechy.com` shows the landing page.

### 7. TLS with Certbot

```bash
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
sudo certbot --nginx -d career.itsnottechy.com
```

Follow prompts. Renewal is scheduled automatically by the snap.
After issuance, visiting `https://career.itsnottechy.com` should work and HTTP should redirect to HTTPS.

### 8. Deploying updates

```bash
cd /opt/itsnottechy-careers
git pull
npm ci
npx prisma migrate deploy
npm run build
pm2 restart itsnottechy-careers
```

### Backups (manual cron suggestions — not installed by deploy)

Add via `crontab -e`:

```cron
# Daily Postgres dump at 03:15
15 3 * * * pg_dump -U careers careers | gzip > /var/backups/postgres/careers-$(date +\%F).sql.gz

# Daily uploads tarball at 03:30
30 3 * * * tar -czf /var/backups/uploads/uploads-$(date +\%F).tar.gz -C /var/itsnottechy uploads

# Rotate (keep 30 days)
0 4 * * * find /var/backups -type f -mtime +30 -delete
```

---

## Project layout

```
src/
  app/                # Next.js App Router
    (auth)/           # login, register, invite, reset
    api/              # auth, upload, files
    dashboard/        # role-based dashboards
  components/         # UI components
    ui/               # Button, Input, Card, etc.
  emails/             # HTML templates + base layout
  lib/                # business logic, services, helpers
    auth/             # NextAuth + session helpers
    email/            # sendEmail, transport, templates
    services/         # userService etc.
    validation/       # Zod schemas
  types/              # shared TS types
  middleware.ts       # route protection
prisma/
  schema.prisma
  migrations/
  seed.ts
docs/
  superpowers/
    specs/            # design docs
    plans/            # phase-by-phase implementation plans
```

---

## What's next

Phase 1 (the three plan files under `docs/superpowers/plans/`) gets you a
deployable foundation with working auth. Subsequent phases — Jobs+Apply,
ATS Pipeline, Referrals, Interviews, Promotions, Admin polish — are tracked
in `docs/superpowers/specs/2026-05-17-itsnottechy-careers-design.md` and have
their own implementation plans written before each phase starts.
