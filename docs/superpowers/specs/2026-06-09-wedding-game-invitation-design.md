# Mobile Wedding Game Invitation Design

Date: 2026-06-09
Project root: `/Users/sjlee/Documents/New project 5`
Status: Draft for user review

## Goal

Build a mobile-first wedding invitation that feels like entering a small pixel game, not reading a static invitation page. Guests enter a garden festival world as pixel characters, see other guests moving in real time, explore wedding information, and submit RSVP or guestbook messages from in-world spots.

The target is a polished MVP that can be hosted as cheaply as possible while still supporting real-time multiplayer for roughly 100 concurrent guests.

## Confirmed Decisions

- World style: garden festival pixel world.
- Multiplayer: real-time multiplayer is required.
- Story mode: include story exploration, not only a shared lobby.
- Hosting: keep the front end on GitHub Pages where possible.
- Low-cost backend: use Cloudflare Durable Objects as the real-time room server and Cloudflare D1 for saved data.
- Entry: public link. Anyone with the link can enter.
- Guest onboarding: nickname first, then enter the world.
- RSVP: handled later inside the world from the RSVP booth.
- Controls: support both tap-to-move and a small virtual joystick.
- MVP spots: wedding info, directions, RSVP, guestbook, bride/groom introduction, gallery, and relationship story path.
- Avatar customization: choose a base pixel character and color.

## Architecture

The app is split into three deployable pieces.

1. React/Vite static client on GitHub Pages

The static client owns all visible UI, map rendering, player movement, collision against map bounds and booths, bottom sheets, modals, RSVP forms, guestbook forms, and gallery screens. GitHub Pages is appropriate because it hosts static HTML, CSS, and JavaScript from a repository.

2. Cloudflare Worker + Durable Object

The Worker exposes the WebSocket endpoint and routes each wedding invitation into a single Durable Object room. The Durable Object acts as the garden room server. It accepts WebSocket connections, tracks active guests in memory, assigns a session guest ID, broadcasts enter/move/stop/leave events, and cleans up stale connections.

Use Cloudflare's WebSocket Hibernation API so idle rooms can sleep without disconnecting clients. Cloudflare documents Durable Objects as WebSocket endpoints that can coordinate multiple clients, including multiplayer-style use cases, and recommends hibernation for cost control.

3. Cloudflare D1 database

D1 stores persistent data only: RSVP submissions, guestbook messages, hidden/visible moderation state, invitation configuration, and optional gallery metadata. It should not store every movement event.

## Hosting And Cost

The target operating model is:

- GitHub Pages: static hosting for the React/Vite build.
- Cloudflare Durable Objects: real-time multiplayer room.
- Cloudflare D1: RSVP and guestbook persistence.
- Cloudflare R2: optional later only if gallery images become too large for the static app bundle.

Cloudflare's current D1 product page says D1 has usage-based pricing with no idle-time or data-egress charge, and the Workers Free plan includes daily D1 limits. Cloudflare Durable Objects pricing examples show WebSocket hibernation materially changes cost; a moderately trafficked example with 100 Durable Objects and 100 hibernatable connections per object is estimated at $10/month including a $5 minimum usage charge. This wedding app should start much smaller than that example because it normally needs one room per invitation and short traffic bursts, but a paid Cloudflare plan should be treated as the practical deployment target to avoid fragile free-tier assumptions.

Cost target:

- MVP/testing: $0/month may be possible inside free limits.
- Real wedding deployment: plan for roughly Cloudflare's low paid tier, with budget monitoring and alarms enabled.
- Avoid always-on VPS, Render, Fly.io, or Railway for the first version unless Cloudflare Durable Objects proves unsuitable.

## Game Flow

1. Landing / entry

Guests open the shared link. The first screen asks for a nickname and lets the guest choose a base pixel character and color. The app should make entry feel lightweight. Do not require RSVP or a code before entering.

2. Garden world

After entry, the guest appears in a small top-down pixel garden. The map is compact enough to understand on a phone without a minimap. Guests can tap a destination to auto-walk or use the virtual joystick for direct movement.

3. Real-time presence

Other connected guests appear as small pixel characters with nickname labels. They do not block movement. Their positions are interpolated locally to avoid jitter.

4. Interactive spots

When the player approaches a booth or sign, an action button appears. Tapping it opens a bottom sheet or modal. Required spots:

- Wedding info booth: date, time, venue, ceremony details.
- Directions sign: address, map link, transit/parking notes.
- RSVP booth: attendance, guest count, meal/side notes if needed.
- Guestbook mailbox: congratulatory message submission.
- Bride/groom garden: short introductions.
- Gallery: selected photos.
- Story path: timeline of the couple's relationship.

5. Saved data

RSVP and guestbook writes go to D1 through Worker endpoints. The client should never write directly to D1. The Worker validates request shape, invitation ID, length limits, and simple abuse controls.

## Real-Time Protocol

The client connects to:

`wss://<worker-domain>/rooms/<invitationId>`

Client-to-server messages:

- `join`: nickname, avatar type, avatar color.
- `move`: x, y, direction, moving flag, sequence number.
- `ping`: client heartbeat.
- `leave`: optional graceful exit.

Server-to-client messages:

- `welcome`: assigned guest ID, current guest snapshot.
- `guest_joined`: new guest profile and position.
- `guest_moved`: guest ID and latest position state.
- `guest_left`: guest ID.
- `room_state`: periodic compact snapshot for resync.
- `error`: safe client-facing error code.

Rules:

- Throttle outbound movement messages to at most 10 per second per client.
- Batch or coalesce server broadcasts where practical.
- Do not persist movement events.
- Drop malformed messages.
- Remove guests after disconnect or heartbeat timeout.
- Clamp coordinates server-side to known map bounds.

## Data Model

D1 tables:

`invitations`

- `id`
- `slug`
- `title`
- `wedding_date`
- `venue_name`
- `venue_address`
- `config_json`
- `created_at`

`rsvps`

- `id`
- `invitation_id`
- `guest_name`
- `attendance`
- `party_size`
- `note`
- `created_at`

`guestbook_messages`

- `id`
- `invitation_id`
- `nickname`
- `message`
- `is_hidden`
- `created_at`

`moderation_events`

- `id`
- `invitation_id`
- `target_type`
- `target_id`
- `action`
- `created_at`

Admin functionality is intentionally minimal for MVP. The first version can expose moderation through protected Worker endpoints or a small admin route later. The public guest experience should not wait on a full admin dashboard.

## Visual Direction

The first implementation should use a warm, hand-crafted garden festival art direction:

- Pixel top-down map with grass, flower beds, path intersections, signs, booths, mailbox, arch, and photo area.
- Soft wedding palette: warm paper, muted rose, leaf green, sky blue, and gold.
- UI should be clean and readable, not overly decorative.
- Bottom sheets should feel like invitation stationery layered over the game.
- Mobile-first layout is mandatory; desktop can center a phone-like game viewport.

Before implementing the final visual UI, generate or create production assets for:

- Player sprites with a few color variants.
- Garden terrain tiles.
- Booth/sign props.
- Flower/path/arch assets.
- Optional decorative background or loading scene.

## MVP Boundaries

Included:

- Static React/Vite app.
- Pixel garden world.
- Tap-to-move and joystick movement.
- Local collision with map edges and booths.
- WebSocket multiplayer room using Durable Objects.
- Nickname and avatar customization.
- RSVP submission.
- Guestbook submission and display.
- Gallery and story/info modals.
- Mobile responsive layout.
- Basic rate limiting and input validation.

Not included in MVP:

- Login for guests.
- Private invite code.
- Player-to-player chat.
- Quest system or hidden items.
- Multiple map zones.
- Server-authoritative physics.
- Full admin dashboard.
- Payments, gifts, or account transfer workflow.

## Error Handling

- If WebSocket connection fails, the app still opens in solo mode and shows a small "offline garden" state.
- If a movement message fails, the local player should keep moving; remote presence can reconnect in the background.
- If RSVP or guestbook submission fails, keep the form data and show a retry action.
- If D1 write validation fails, show a human-readable message without exposing backend details.
- If the room reaches a configured capacity, allow solo browsing and show that live guest display is full.

## Security And Abuse Controls

- Public entry is intentional, so protect writes instead of blocking entry.
- Validate all Worker API inputs.
- Limit nickname, RSVP, and guestbook lengths.
- Add simple per-IP or per-session submission throttles in the Worker.
- Store moderation state for guestbook messages so unwanted entries can be hidden later.
- Do not store secrets in the static client.
- Keep Cloudflare credentials and deployment tokens out of the repository.

## Testing Strategy

Automated checks:

- Unit tests for movement math, collision bounds, message parsing, and throttling.
- Worker tests for WebSocket join/move/leave handling.
- D1 integration tests for RSVP and guestbook endpoints using local/miniflare-style tooling.
- Build/lint/type checks for client and Worker.

Manual verification:

- Open the app on mobile-sized and desktop viewports.
- Verify nickname entry, avatar selection, movement, spot actions, RSVP, and guestbook.
- Run two or more browser sessions to confirm real-time presence.
- Simulate WebSocket disconnect and ensure solo mode/reconnect behavior works.
- Check that GitHub Pages build output does not require server-side rendering.

## Open Assumptions

- One public invitation room is enough for MVP.
- Korean copy and wedding details will be filled later.
- The app can launch with generated sample wedding data during implementation, using explicit sample values for couple names, wedding date, venue, gallery items, and story timeline.
- Cloudflare will be the backend deployment target unless a cost or platform blocker appears.

## References

- GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages
- Cloudflare Durable Objects WebSockets: https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- Cloudflare Durable Objects pricing: https://developers.cloudflare.com/durable-objects/platform/pricing/
- Cloudflare D1 product/pricing overview: https://www.cloudflare.com/developer-platform/products/d1/
