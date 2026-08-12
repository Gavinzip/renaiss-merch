# Merch Asset Deletion Review

Status: six confirmed-wrong images deleted on 2026-08-09 after the user gave
an explicit deletion instruction. One superseded image remains retained.

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

## Retained despite being unused

- All Bracelet source product images and detail cutouts.
- All Bracelet 3D crops, PBR maps, comparisons, and previews.
- All T-shirt reveal storyboards and extracted frames.
- Original logo references and current UI captures.
- Packaging and background concepts that are unused but not explicitly known
  to be wrong.
- The approved Bracelet generation output retained in the Bracelet-specific
  `generation-provenance/` directory.
