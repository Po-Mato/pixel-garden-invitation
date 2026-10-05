# Common Pages visits

This addition combines blog document-open events with the existing `sample-garden` invitation `visit` totals. It never rewrites historical invitation rows or adds a second invitation visit event. The existing invitation owner admin session is required; tokens for any other invitation are denied. The common section lives at `/pixel-garden-invitation/?admin=analytics`.

## Collection contract

The blog sends only `{site: 'blog', event: 'visit', eventId: <random UUID v4>}` to the existing Worker `/api/pages/visits`. A document-scoped memory guard prevents duplicate React mounts and SPA navigation. Reloading opens a new document and counts again. Up to three attempts share the same ID; pending work expires after 15 minutes. Requests omit credentials and Referer. DNT, GPC, automation and non-production hostnames opt out. There is no new cookie, localStorage value, permanent visitor ID or fingerprint.

The Worker admits only the existing Pages origin, fixed fields/values and a maximum 256-byte body. It stores a daily KST count and a temporary receipt with a 24-hour expiry. Receipt insertion and count increment are atomic via a SQLite trigger. Existing five-minute cron removes expired receipts; cleanup failure is isolated from existing scheduled work. There are no analytics IP, URL path/query/hash, referrer, User-Agent, nickname or message columns. Infrastructure still handles normal network metadata; no new request logging is enabled.

Daily and period totals count received document-open events, not sessions or distinct people. Blog dates before collection readiness are null/“미수집”; partial totals are labeled. The first collection day is partial. Existing invitation behavior (including its old local returning-visit marker) is unchanged. Blocked/failed delivery undercounts; refreshes, self-visits and automated clients that do not opt out can count. CORS does not authenticate public senders or guarantee bot-free numbers.

## Cost review / deployment gate

2026-10-05: existing OAuth has Workers Scripts/D1 write and Account read. Workers account settings returned `default_usage_model: standard`, which is NOT proof of a free subscription. GET account subscriptions returned HTTP 403. D1 query insights are accessible, but sampled/top-query observations are NOT account-wide remaining quota. Do not claim a verified free plan or deploy until existing account billing/usage evidence is available. Do not create a new token, change a subscription, or broaden permissions to bypass this limitation.

Incremental load: each document adds one successful POST (up to three attempts), possible CORS preflight, one receipt insert and one daily upsert. Indexed receipt cleanup runs on the existing cron. A conservative planning allowance is about eight D1 row/index writes per accepted event including later removal, plus read/duplicate overhead; this is an estimate, not a measured invoice. For example, 1,000 events/day would budget approximately 8,000 writes/day, NOT a prediction of real traffic. Current Free published limits are 100,000 D1 row writes/day and 5 million reads/day; all account workload shares limits. Existing paid accounts can incur overage. No quota or spending settings are changed.

## Safe release order (not executed while cost verification is blocked)

1. Record current source SHAs, Worker deployment version and fresh D1 Time Travel bookmark. Bookmark lookup was tested read-only; no personal data export is needed.
2. Review and apply ONLY additive migration `0027_common_pages_analytics.sql` through the existing migration path; never run an unreviewed set of pending migrations. Existing tables are untouched. `enabled_at` is backend readiness, not a fabricated first visit.
3. Deploy Worker with the existing bindings/secrets and verify health/auth rejection without POSTing fake visits.
4. Publish admin client through existing Pages workflow and blog source through `tech-blog/.github/workflows/deploy-to-po-mato-pages.yml`. Do not edit generated `Po-Mato.github.io` directly. Preserve existing deploy secret.
5. Verify built script/privacy notice and private dashboard assets by GET; use intercepted local browser requests for synthetic journeys. Read real aggregate rows later, never seed visits in production. Record frontend activation time separately from DB readiness.
6. On problems, revert the blog script/layout and admin change and disable the new Worker collection route while keeping its receipt cleanup running through the 24-hour retention period. Keep additive tables and historical counts; no destructive rollback/drop. A full Worker version rollback before cleanup would leave receipts retained, so prefer a forward rollback that preserves cleanup, or complete expiry cleanup before restoring the old Worker.

## Local verification

In-memory SQLite tests cover retry idempotency, invitation-history preservation, partial history, receipt expiry and auth/range checks. Browser tests use the local static export for the production hostname and intercept every network request; no live event is sent. They check first document=1, SPA navigation=1, reload=2, exactly three payload fields and no Referer/cookie/query. Main app and blog build/test results are reported separately. Full remote CI and actual installation remain unexecuted until the cost gate is resolved.
