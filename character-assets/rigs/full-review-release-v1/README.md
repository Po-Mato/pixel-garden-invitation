# Reviewed character production release

User approved deployment of the local full character review on 2026-09-30. The original working directory contained unrelated uncommitted changes, so this release was assembled in an isolated checkout of origin/main e9fa854.

The full-review-v1 package contains twelve guests × four directions × four frames. It selects the reviewed canonical/tailored sources, hanbok v8 side/back, v7 male front, and v10 female front. V10 composites only the approved generated neck/collar pixels into v9, preserving everything outside the patch. Couple sprites keep the source artwork and align the head by integer translation.

Production generation now uses this package, verified against production-review.json. The 2,783 source dependencies are a recursive receipt closure; each is hash-bound. Editable SVGs, their source art, source receipts, and necessary intermediates are included so a clean CI checkout cannot silently fall back to old assets. Historical storybook commands remain available separately.

Evidence includes the previous local review and an actual production-build Chrome capture on the user's Mac (390×844). All 48 selector directions expose all four frame states, approved HD hashes match, all 24 runtime walk/idle hashes match, and the guest-02 world character moves at a logical 48×72. The map contrast audit retains existing thresholds and all 1,920 samples. Broad physical-device coverage is not claimed.

The visual baseline update covers the user-approved character changes; map art is unchanged. Git preserves the old source, evidence, and baseline. No Worker configuration, database, service access, or paid resources changed.
