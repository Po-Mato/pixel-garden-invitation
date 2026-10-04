# Couple-style guest production package

The 2026-10-04 user-approved pixel-style guest direction is built separately from the preserved historical full-review-v1 assets. The user explicitly approved production deployment. The bride/groom artwork is unchanged.

Run `pnpm dev:couple-style` from the release-character-deploy checkout. This normalizes the retained OpenAI-generated character-only sources, builds 12 guests × 4 directions × 4 walk frames plus front idle/portraits, and serves the local app on port4173. The same package is the default in production; the generator restores its files after the historical generator clears its output directory.

Sources are immutable copies in sources/. source-map.json preserves generation file provenance. normalize-couple-style-sources.mjs finds the transparent row gutter (including odd-sized sheets), removes semitransparent fringe with a128 alpha mask, and uniformly registers each pose to192×288, top54/foot270. Cropping/masking/alignment reuses generated pixels; no code-painted anatomy is introduced.

The 216px source silhouette remains un-enlarged in the asset. The previously reviewed world-layer CSS scales7/6 once around the foot point, giving63px of visible height inside the existing48×72 world frame. Do not enlarge the source to252px as well: that would double-apply this correction.

Motion uses the new neutral pixels only. Head/neck/shoulder rows0..144 and neutral frames1/3 remain exact. Small continuous deformations reuse existing pixels. Topology guards disable arm motion in six directions to preserve thin gaps. Front tailored guests03/04/09/11 can alternately lift one grounded foot by2 source pixels; long skirts and other directions use smaller visible-surface motion without inventing hidden limbs. This is restrained cutout motion, not a newly drawn full-stride animation.

Validation artifacts: task/output/couple-style-full/. The production-review.json record binds the approved sources, exact package and inspected evidence. The service worker core uses the new default guest paths and revision.
