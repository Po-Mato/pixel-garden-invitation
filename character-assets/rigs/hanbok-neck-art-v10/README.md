# User-authorized local A neck material, v10

The v9 original and all unrelated user work are retained. The donor is the first generated A (approved for localized neck/collar compositing), not the later failed local-edit attempt.

`render-hanbok-front-rig-v10.mjs` registers the unchanged v9 upper-body artwork and adds a raster donor only within a fixed neck/collar selection before splitting editable rig parts. It does not resample the existing upper body. The selection is x81–108, y126–146 on the 192×288 canvas; donor alone is reduced and translated left one pixel. Soft opacity stays inside the selection. All four rendered frames differ from v9 by 437 pixels inside that envelope; zero changes outside. Small interior alpha changes come from source-layer compositing, not silhouette/background changes. Face, hair, sleeves, skirt, feet, bones and baseline remain unchanged.

The new twelve-character local package chooses this female front, unchanged approved male front v7, and independently authored v8 left/right/back hanbok sources. Other ten guests use their verified current canonical/tailored source routes.

Run `pnpm dev` or `pnpm dev:characters` for the local app. `pnpm dev:storybook` preserves the prior development command. Production generation/approval gates are unchanged. No deployment approval is claimed.

Validation: `pnpm characters:review:test`; 12×4×4 geometry/neutral/baseline/center checks in package builder; source/output SHA256; all 48 directions observed playing frames0–3 and paused frame1 in local Chrome390×844. Actual selection UI currently enlarges to160×240; standalone review supplies exact96×144 and48×72. Game world uses48×72. The neck improvement is subtle at that size. Final approval of visual taste is not an automated-test claim.
