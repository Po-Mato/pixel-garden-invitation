# Character Art Direction Lock

This project’s bride and groom NPC art is locked to the approved reference from Codex session `019eabf9-3872-7d40-9d46-157edc38abc5`.

Source of truth:

- `character-assets/reference/approved-couple.png`
- `character-assets/reference/approved-couple.json`
- `character-assets/reference/couple-source-lock.json`

Fixed direction:

- Art direction: ornate romantic fashion pixel art.
- Proportion: A2 balanced compact.
- Face: F1 clear and refined.
- Idle pose: standing portrait pose from the approved upper-row reference. The garden NPCs must read as standing for a posed wedding portrait, not mid-walk.
- Walk pose: compact gameplay walking pose from the approved lower-row reference. Walking posture belongs only in `*-walk.png`.
- Groom: layered dark hair, black fitted tuxedo, satin lapels, white shirt, bow tie, boutonniere, polished shoes.
- Bride: waist-length dark-brown waves, pearl/floral headpiece, ivory lace gown, bouquet, layered skirt/train detail.

Non-negotiable rule:

Do not replace bride/groom NPCs with simplified block art, generic low-detail pixel characters, or assets that drop the approved reference’s fashion/detail language.

Future changes to `character-assets/source/npc/*` must be treated as an intentional art-direction change. Before merging, update the lock metadata only after visual approval against `approved-couple.png`, then run:

```bash
pnpm characters:contact-sheet -- --mode=couple --output=.superpowers/character-review/couple-art-review.png
pnpm characters:audit -- --scope=couple
pnpm characters:test
pnpm test
pnpm typecheck
pnpm build
```
