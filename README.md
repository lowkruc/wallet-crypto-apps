# test-nestjs-vite-monorepo

This repo hosts a small pnpm-based monorepo with two apps:

- `apps/api`: a NestJS API
- `apps/admin-web`: a Vite + React admin interface

Both projects share dependencies through pnpm workspaces and rely on the same environment files stored at the repo root. Local development defaults to `.env.local`, production tooling expects `.env.production`.

## Getting started

```bash
pnpm install
cp .env.local .env.local.example # or update the provided file
```

While working locally you can run both apps at once:

```bash
pnpm dev            # api on 3000, admin on 4173
pnpm dev:api        # API only
pnpm dev:admin      # admin only
```

Shared scripts exist for build, lint, test, and migrations. Each command accepts per-app variants, so `pnpm lint:api` or `pnpm build:admin` work exactly as expected.

## Environment files

Root env files supply values to both apps plus Docker/Make targets:

- `.env.local`: defaults for local dev (ports, `VITE_API_BASE_URL`, etc.).
- `.env.production`: used by Docker Compose, CI, and deployment scripts on the VM.

Important keys:

- `API_PORT`, `ADMIN_WEB_PORT`: what the raw services listen on (3000/4173 locally).
- `API_SERVER_NAME`, `ADMIN_SERVER_NAME`, `NGINX_PORT`: only required in `.env.production` for the nginx reverse proxy that runs in deployment.

Anything sensitive—SSH host/user/key, registry, etc.—should stay in GitHub secrets/variables or your shell, not in these files.

## Docker

Dockerfiles live next to each app plus `infra/nginx` for the shared reverse proxy. Common commands sit in the repo root `Makefile`:

```bash
make docker-up         # builds both services locally with .env.local
make docker-down
make docker-build      # builds using .env.production
make push-images       # builds + pushes ghcr images (requires DOCKER_REGISTRY env)
```

`docker-compose.yml` exposes the API on `localhost:${API_PORT}` and the admin on `localhost:${ADMIN_WEB_PORT}` with no nginx dependency. In production stick to `docker-compose.deploy.yml`, which consumes the three registry images (API, admin, reverse proxy). `make deploy` rsyncs the repo to a VM and runs that compose file with your `.env.production` values so nginx can terminate on the domains you set.

## CI/CD

The workflow under `.github/workflows/ci.yml` runs whenever you push a `v*` tag. Jobs perform linting, testing, migration checks, then build and push three Docker images (API, admin, reverse proxy) to GHCR using the tag name. The final step SSHes into the target VM, pulls the new images, and restarts the stack with `.env.production`.

Provide the following secrets/vars in GitHub:

- `SSH_HOST`, `SSH_USER`, `SSH_KEY`, `SSH_TARGET_DIR`
- `VITE_API_BASE_URL` (for the admin Docker build)
- `IMAGE_PREFIX` if you want something different from the default `ghcr.io/<repo>`

With those in place, tagging a commit (e.g. `git tag v0.0.1 && git push origin v0.0.1`) will build and deploy automatically.

## Repository layout

```
apps/
  api/           # Nest app
  admin-web/    # Vite/React admin
infra/
  nginx/        # reverse proxy Dockerfile + template
.github/
  workflows/
Makefile
.env.local / .env.production
```

## Common commands

| Purpose        | Command                |
| -------------- | ---------------------- |
| Install deps   | `pnpm install`         |
| Run all dev    | `pnpm dev`             |
| Run tests      | `pnpm test`            |
| Lint           | `pnpm lint`            |
| Build          | `pnpm build`           |
| Migrations     | `pnpm migrate` (update script in `apps/api/package.json`)
| Deploy via SSH | `make deploy`          |

Feel free to plug in your own DB, ORM, or additional apps—the workspace setup should handle it.
