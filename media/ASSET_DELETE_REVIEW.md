# Merch Asset Deletion Review

Status: six confirmed-wrong images were deleted on 2026-08-09. On 2026-08-14,
the user selected the gold/rainbow and silver/colorless Bracelet 3D finishes as
the two keepers and instructed that the other generated Bracelet 3D work be
removed. One unrelated superseded image remains retained.

These files were selected only when there was direct evidence that the result
was rejected, superseded, used an incorrect generated logo, or depicted
unrelated products. Website inputs, source masters, approved generation
provenance, and product-detail images are intentionally excluded.

These were historical files from earlier work. Before deletion, each exact
path was listed to the user, checked for website and manifest references, and
verified as an existing local image.

## Deleted confirmed-wrong images

| File | Reason |
| --- | --- |
| `private/merch/products/bracelet/archive/images/box-closed-storefront-color-rejected-20260805.png` | Filename and asset history mark this generated color treatment as rejected. |
| `private/merch/shared/workbench/branding/preview-imagegen-logo.png` | Generated logo comparison differs from the preserved original logo. |
| `private/merch/shared/workbench/branding/renaiss-gift-logo-imagegen-key.png` | Generated logo key image; not the canonical brand mark and not referenced by the website. |
| `private/merch/shared/workbench/branding/renaiss-gift-logo-imagegen-transparent.png` | Generated logo variant; not the canonical brand mark and not referenced by the website. |
| `private/merch/shared/workbench/packaging/renaiss-merch-product-sample-hd.png` | Generated open-box concept contains unrelated merchandise and is not referenced by the website. |
| `private/merch/shared/workbench/packaging/renaiss-merch-product-sample-hd-2x.png` | Higher-resolution copy of the same unrelated-product concept. |

## Retained review item

| File | Reason retained |
| --- | --- |
| `private/merch/products/bracelet/archive/images/box-closed-storefront-deterministic-horizontal-superseded-20260805.png` | It is superseded, but there is no direct evidence that the image itself was generated incorrectly. |

## Bracelet 3D cleanup on 2026-08-14

The approved keeper textures were promoted to:

- `private/merch/products/bracelet/workbench/3d/final/textures/bracelet-center-gold-rainbow-uv.png`
- `private/merch/products/bracelet/workbench/3d/final/textures/bracelet-center-silver-colorless-uv.png`

After dependency and provenance checks, 178 generated work files (81 MB) were
moved out of the project to the recoverable macOS Trash location
`/Users/gavin/.Trash/renaiss-merch-bracelet-cleanup-20260814/`. The exact
project roots removed were:

- `private/merch/products/bracelet/workbench/3d/openscad/v1/`
- `private/merch/products/bracelet/workbench/3d/v1/`
- `private/merch/products/bracelet/workbench/3d/v3/`
- `private/merch/products/bracelet/workbench/3d/v4/`
- `work/generated-images/2026-08-13-bracelet-full-chain/`
- `work/generated-images/2026-08-13-bracelet-modeling-reference/`
- `work/generated-images/2026-08-13-bracelet-silver/`
- `work/generated-images/2026-08-14-bracelet-uv-textures/`
- `src/three/assets/bracelet-center-front-projection.png`
- `src/three/assets/bracelet-center-front-projection-registered-candidate.png`
- `src/three/assets/bracelet-center-front-projection-silver-candidate.png`
- `src/three/assets/bracelet-center-front-projection-silver-registered-candidate.png`

No user-provided original, product source, website input, release media,
generation-provenance file, archive file, or Codex preview-cache file was
included in this cleanup.

## Retained despite being unused

- All Bracelet source product images and detail cutouts.
- The two approved Bracelet 3D modeling references and the two final UV masters.
- All T-shirt reveal storyboards and extracted frames.
- Original logo references and current UI captures.
- Packaging and background concepts that are unused but not explicitly known
  to be wrong.
- The approved Bracelet generation output retained in the Bracelet-specific
  `generation-provenance/` directory.
