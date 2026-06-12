# Wedding Game Invitation

A mobile-first pixel garden wedding invitation. Guests enter as avatars, explore wedding information, see realtime presence, and submit RSVP or guestbook messages through a Cloudflare Worker backend.

## Local Development

Install dependencies from the repository root:

```bash
npm install
```

Create local environment files from the examples:

```bash
cp client/.env.example client/.env.local
cp worker/.dev.vars.example worker/.dev.vars
```

Run the Vite client:

```bash
npm run dev
```

Run the Cloudflare Worker locally:

```bash
npm run dev:worker
```

Run project checks:

```bash
npm run test
npm run typecheck
npm run build
```

## Architecture

- `shared` contains shared TypeScript contracts, protocol types, invitation content, and validation helpers.
- `client` contains the React/Vite game UI, movement controls, in-world panels, HTTP API adapter, and WebSocket realtime client.
- `worker` contains the Cloudflare Worker entrypoint, Durable Object realtime room, D1-backed RSVP and guestbook endpoints, validation, and rate limiting.
- The static client is built into `client/dist`; the Worker and Durable Object are configured through `worker/wrangler.toml`.

## Deployment Notes

- GitHub Pages deployment is configured in `.github/workflows/pages.yml`. On pushes to `main` or manual dispatch, it installs dependencies, runs tests, builds the workspace, uploads `client/dist`, and deploys it with GitHub Pages.
- Set `VITE_WORKER_URL` to the deployed Worker origin and `VITE_INVITATION_ID` to the invitation ID used by the client build. The example ID, `sample-garden`, is inserted by `worker/migrations/0001_init.sql`.
- Deploy the Worker separately with Wrangler after creating a real D1 database and replacing the placeholder `database_id` in `worker/wrangler.toml`.
- Apply D1 migrations before using RSVP or guestbook writes so the `invitations`, `rsvps`, `guestbook_messages`, and `moderation_events` tables exist.
- Do not commit Cloudflare account IDs, generated credentials, `.dev.vars`, or other local secret files.
