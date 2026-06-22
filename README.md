# Wedding Game Invitation

A mobile-first pixel garden wedding invitation. Guests enter as avatars, explore wedding information, see realtime presence, and submit RSVP or guestbook messages through a Cloudflare Worker backend.

## Local Development

Install dependencies from the repository root:

```bash
pnpm install
```

Create the local client environment file from the example:

```bash
cp client/.env.example client/.env.local
```

The example points the client at the local Wrangler Worker URL, `http://127.0.0.1:8787`.

The Worker currently uses Wrangler bindings from `worker/wrangler.toml` and does not require local secret variables. `worker/.dev.vars.example` documents this; copying it is optional and only needed if local-only Worker secrets are added later.

```bash
cp worker/.dev.vars.example worker/.dev.vars
```

Run the Vite client:

```bash
pnpm dev
```

Run the Cloudflare Worker locally:

```bash
pnpm db:migrate:local
pnpm dev:worker
```

Run project checks:

```bash
pnpm test
pnpm typecheck
pnpm build
```

## Character Assets

Source pixel sheets live in `character-assets/source`.
Character source sheets are hand-authored PNGs. Do not generate character geometry from code.

Use the local editor and review tools:

```bash
pnpm characters:editor
pnpm characters:audit
pnpm characters:generate
pnpm characters:contact-sheet -- --mode=catalog --output=/tmp/character-catalog.png
```

The editor runs only on `127.0.0.1:41731`. Palette generation may recolor exact marker pixels, but it must not create body, face, hair, outfit, or NPC geometry.

The generated files in `client/public/characters/generated` are ignored and rebuilt in CI.
Catalog IDs and compatibility rules live in `shared/character-catalog.json`.

## Architecture

- `shared` contains shared TypeScript contracts, protocol types, invitation content, and validation helpers.
- `client` contains the React/Vite game UI, movement controls, in-world panels, HTTP API adapter, and WebSocket realtime client.
- `worker` contains the Cloudflare Worker entrypoint, Durable Object realtime room, D1-backed RSVP and guestbook endpoints, validation, and rate limiting.
- The static client is built into `client/dist`; the Worker and Durable Object are configured through `worker/wrangler.toml`.

## Deployment Notes

- GitHub Pages deployment is configured in `.github/workflows/pages.yml`. On pushes to `main` or manual dispatch, it installs dependencies, runs tests, builds the workspace, uploads `client/dist`, and deploys it with GitHub Pages.
- Before enabling Pages deployment, configure the GitHub repository variable `VITE_WORKER_URL` with the deployed Worker origin, for example `https://wedding-game-invitation.example.workers.dev`. The workflow also reads the optional repository variable `VITE_INVITATION_ID`; if it is not set, the client build uses `sample-garden`.
- The example invitation ID, `sample-garden`, is inserted by `worker/migrations/0001_init.sql`.
- Deploy the Worker separately with Wrangler after creating a real D1 database and replacing the placeholder `database_id` in `worker/wrangler.toml`.
- Apply D1 migrations before using RSVP or guestbook writes so the `invitations`, `rsvps`, `guestbook_messages`, and `moderation_events` tables exist. For local development, run `pnpm db:migrate:local`.
- Do not commit Cloudflare account IDs, generated credentials, `.dev.vars`, or other local secret files.
