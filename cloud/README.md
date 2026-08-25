# NullDraft Cloud API

Invite-only access and sync control plane for the desktop app. Users activate a
single-use invitation link before they can use NullDraft. The desktop app keeps
projects, screenshots, reports, and AI usage local by default; this service
stores access records, project manifests, and usage events.

Roles are intentionally simple:

- `user`: every invited account
- `admin`: owner/operator account, assigned when an invited email is listed in `NULLDRAFT_ADMIN_EMAILS`

## Run locally with PostgreSQL

```bash
cd cloud
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env if your PostgreSQL URL is different
uvicorn main:app --reload --port 8010
```

## Run with Docker Compose

```bash
cd cloud
cp .env.example .env
# Set a unique POSTGRES_PASSWORD and NULLDRAFT_BOOTSTRAP_SECRET in .env.
docker compose up --build
```

Docker Compose reads its database credentials, admin email, bootstrap secret, and
allowed origins from `.env`. Never use the example secrets in production.

## First administrator

There is no public registration endpoint. Set both `NULLDRAFT_ADMIN_EMAILS` and
`NULLDRAFT_BOOTSTRAP_SECRET`, then create the one-time first-admin invitation:

```bash
curl -X POST http://127.0.0.1:8010/v1/bootstrap/invitation \
  -H "X-Bootstrap-Secret: $NULLDRAFT_BOOTSTRAP_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","name":"Your Name"}'
```

Open the returned `activation_url` on the administrator's desktop. They can
then manage invitation links in Settings → Invitations. Links expire after 72
hours, work once, and can be revoked until activation.

## Production checklist

- Set `NULLDRAFT_ENV=production`.
- Set `DATABASE_URL` to managed PostgreSQL or your production Postgres container.
- Set `NULLDRAFT_ADMIN_EMAILS` to your owner email.
- Set `NULLDRAFT_CLOUD_ORIGINS` to exact HTTPS origins; never `*` in production.
- Put the API behind HTTPS, for example Caddy using `Caddyfile.example`.
- Keep screenshots/report upload disabled until you have explicit consent and storage rules.
