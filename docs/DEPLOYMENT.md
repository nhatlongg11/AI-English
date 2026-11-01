# Docker deployment

This stack builds the React frontend and TypeScript backend from this repository.
It uses the existing Prisma/SQLite database; PostgreSQL and Redis are not required.
Install Docker Engine with Docker Compose **2.30.0 or newer** (for raw env files).

## Configure and start

1. Copy the repository to the server, including `package-lock.json`.
2. Provide `.env` in the repository root. You can reuse your current configuration,
   or copy `.env.example` and replace the placeholder staff tokens with separate
   random values of at least 32 characters. Preserve existing actor IDs when
   migrating data so teacher ownership and review records continue to match.
3. Set `GEMINI_API_KEY` and the model prices described in [GEMINI_SETUP.md](GEMINI_SETUP.md).
   Use `AI_MOCK_MODE=false` for real Gemini calls. Startup does not call Gemini.
4. Run:

   ```sh
   docker compose up -d --build
   docker compose ps -a
   docker compose logs --tail=100 init api web
   ```

Open `http://127.0.0.1:8080` on the server. Health is available at
`http://127.0.0.1:8080/api/v1/health`. React routes such as `/login` work on refresh.

`HTTP_BIND` defaults to `127.0.0.1` for a reverse proxy or host-installed
Cloudflare Tunnel. Set `HTTP_BIND=0.0.0.0` in `.env` for access from other machines,
and optionally change `HTTP_PORT=8080`. Configure your HTTPS proxy/tunnel to forward
to that port. If cloudflared runs in a container, its `localhost` is a different
container: attach it to this stack's network and use `http://web:8080` instead.

The API uses port 3000 inside Docker and is not published to the host. Nginx
serves the compiled frontend and proxies `/api/` requests to it on the same origin.
No Vite development server is used. Both long-running containers run as non-root.

## Initialization and persistence

The `init` container applies migrations and seeds only taxonomy/skills, then exits
successfully. The API waits for it; the frontend waits for the API health check.
No demo accounts or example questions are inserted. Log in with a staff token
from `.env`; admins/teachers can provision students in the application.

The named volume `tenselab_app-data` stores `/app/data/tenselab.db`. Docker overrides
the local `DATABASE_URL`, `HOST`, and `PORT` to use the volume and container network.
The frontend image receives no runtime secrets. `.env`, local databases and
`.tmp` are excluded from the Docker build context.

The `.env` file is read with `format: raw`. Write values directly after `=`:
keep `AUTH_CREDENTIALS_JSON=[{"token":"...","role":"admin","actorId":"admin-1"}]`
on one line, without wrapping the whole value in extra single or double quotes.
Do not use shell variable substitutions inside values. Avoid printing
`docker compose config` without `--quiet`, as it includes resolved credentials.

## Bring your existing database

A new volume starts empty; the stack does not automatically import `prisma/dev.db`.
To preserve your students, questions and progress:

1. Stop the local backend before copying the database to the server. Do not copy
   a live SQLite file while requests are writing to it.
2. Place the copied database at `prisma/dev.db` on the server alongside the matching
   `.env`, then run this **before the first `up`**:

   ```sh
   docker compose build
   docker compose run --rm --no-deps --user root --volume ./prisma:/import:ro init sh -c 'test ! -e /app/data/tenselab.db && cp /import/dev.db /app/data/tenselab.db && chown node:node /app/data/tenselab.db'
   docker compose up -d
   ```

The import refuses to overwrite an existing volume database. The one-off root
command assigns the imported file to the non-root app user; normal services run
as non-root. New migrations and taxonomy seeding then run on the imported data.

## Updates and backups

Back up before applying updates. For a consistent backup, stop API writes first:

```sh
docker compose stop api
docker compose cp api:/app/data/tenselab.db ./tenselab-backup.db
docker compose start api
```

Keep the backup outside the server and store `.env` securely with it. The database
alone does not contain the staff access tokens.

After pulling updated source, use this sequence so migrations finish before the
new API accepts requests:

```sh
docker compose build
docker compose stop web api
docker compose run --rm --no-deps init
docker compose up -d --force-recreate
```

If migration fails, investigate the error before starting the new API.
`docker compose down` preserves the data volume; **`docker compose down -v`
deletes it**. Keep one API replica for the current SQLite deployment.

## Client IPs behind another proxy

Docker sets `TRUST_PROXY=uniquelocal` for the internal API. Nginx replaces inbound
forwarded IP headers with its immediate client's address, so direct visitors have
separate rate limits and cannot forge another address. Local development leaves
proxy trust disabled.

When an additional reverse proxy or tunnel sits in front of Nginx, Nginx sees
that proxy as the client. Configure Nginx's real-IP module with that proxy's
specific trusted address/CIDR and forwarded-IP header before serving multiple
users through it; otherwise those users share a rate-limit bucket. Do not trust
forwarded headers from all internet addresses. Keep the API port internal.
