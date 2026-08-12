# Renaiss Merch Asset Index

Read this file before searching for, editing, or generating merch media. The
`private/` directory is intentionally ignored by Git and Docker, so use
`rg --files -uu private/merch` when auditing the complete local inventory.

## Directory model

Photo assets are grouped by product first, then by lifecycle. This keeps every
T-shirt photo collection together and every Bracelet photo collection together
while making the website-approved images unambiguous.

| Class | Location | Purpose | Production rule |
| --- | --- | --- | --- |
| Product source | `private/merch/products/<product>/source/` | Photo masters, physical references, untouched originals, and self-contained product source packages | Never ship in `public` or `dist` |
| Product website images | `private/merch/products/<product>/website/images/` | Canonical private image inputs referenced by the release manifests | Publish only to private R2 |
| Product workbench | `private/merch/products/<product>/workbench/` | Storyboards, generation provenance, 3D research, and product-detail studies | Never publish directly |
| Product archive | `private/merch/products/<product>/archive/` | Superseded or rejected product files pending retention review | Never publish |
| Shared source | `private/merch/shared/source/` | Reusable Store backgrounds and other non-product masters | Never ship in `public` or `dist` |
| Shared workbench | `private/merch/shared/workbench/` | UI captures, branding comparisons, background concepts, and packaging concepts | Never publish directly |
| Tracked website inputs | `src/assets/merch/products/<product>/website/` and `src/assets/merch/shared/website/` | Public Store image inputs for `public-asset-release.json` | Publish as versioned AVIF to public R2 |
| Tracked brand images | `src/assets/brand/website/` and `legacy-src/assets/brand/website/` | Current and legacy website logo inputs, organized locally | Publish the current website inputs through the versioned public R2 release; legacy copies remain source-only |
| Reveal video inputs | `private/merch/runtime/<product>/` | Existing canonical MP4 inputs for both release manifests | Four explicit public versioned R2/CDN exceptions |
| Generated release cache | `.media-assets/` | Rebuildable AVIF/MP4 release output | Not a source library; ignored by Git |

`source` means material to preserve. `website` means an approved local input
that the current website or release pipeline actually uses. Moving a file into
`website` does not make a private product image public.

## Bracelet

### Source material

| Role | Canonical file |
| --- | --- |
| Gold master | `private/merch/products/bracelet/source/images/product/bracelet-gold.png` |
| Gold generated detail variant | `private/merch/products/bracelet/source/images/product/bracelet-gold-generated.png` |
| Silver master | `private/merch/products/bracelet/source/images/product/bracelet-silver.png` |
| Silver generated detail variant | `private/merch/products/bracelet/source/images/product/bracelet-silver-generated.png` |
| Silver cutout detail | `private/merch/products/bracelet/source/images/product/bracelet-silver-cutout.png` |
| Physical closed-box reference | `private/merch/products/bracelet/source/images/packaging/box-closed.png` |
| Approved horizontal Store master | `private/merch/products/bracelet/source/images/packaging/box-closed-storefront.png` |
| Open-box reference | `private/merch/products/bracelet/source/images/packaging/box-open.png` |
| Original forward video | `private/merch/source/bracelet/video/reveal-forward-original-20260728-105601.mp4` |

### Website inputs

| Role | Canonical file | Delivery |
| --- | --- | --- |
| Gold product image | `private/merch/products/bracelet/website/images/product-gold.png` | Private R2 |
| Silver product image | `private/merch/products/bracelet/website/images/product-silver.png` | Private R2 |
| Eligible Store cover | `private/merch/products/bracelet/website/images/store-cover.png` | Private R2 |
| Unrevealed Store image | `src/assets/merch/products/bracelet/website/box-closed.png` | Public R2, key `braceletSealedDrop` |
| Forward reveal | `private/merch/runtime/bracelet/reveal-forward.mp4` | Public versioned R2/CDN MP4 |
| Reverse reveal | `private/merch/runtime/bracelet/reveal-reverse.mp4` | Public versioned R2/CDN MP4 |

The tracked unrevealed Store image must remain byte-for-byte identical to the
approved horizontal source master. The asset pipeline enforces this with a
SHA-256 comparison.

All Bracelet product-detail crops, texture maps, assessment files, and 3D
previews are retained under
`private/merch/products/bracelet/workbench/3d/`. The approved AI generation
output used to create the horizontal Store master is retained under
`private/merch/products/bracelet/workbench/generation-provenance/` so it is
kept with Bracelet instead of a generic generated-image bucket.

## T-shirt

### Website inputs

| Role | Canonical file | Delivery |
| --- | --- | --- |
| Product image | `private/merch/products/shirt/website/images/product.png` | Private R2 |
| Forward reveal | `private/merch/runtime/shirt/reveal-forward.mp4` | Public versioned R2/CDN MP4 |
| Reverse reveal | `private/merch/runtime/shirt/reveal-reverse.mp4` | Public versioned R2/CDN MP4 |
| Unrevealed card image | `src/assets/merch/products/shirt/website/box-card.jpg` | Public R2, key `sealedDrop` |
| Unrevealed catalog image | `src/assets/merch/products/shirt/website/box-catalog.png` | Public R2, key `sealedDropCatalog` |

The full T-shirt reveal storyboards and extracted detail frames are retained
under `private/merch/products/shirt/workbench/reveal-storyboards/`.

## Shared Store material

| Role | Canonical file | Delivery |
| --- | --- | --- |
| Pastel-grid source background | `private/merch/shared/source/backgrounds/pastel-grid-background.png` | Source only |
| Store background | `src/assets/merch/shared/website/store-background.png` | Public R2, key `storeBackground` |
| Renaiss logo mark | `src/assets/brand/website/renaiss-logo-mark.png` | Public R2, key `renaissLogoMark` |
| Renaiss Protocol logo | `src/assets/brand/website/renaiss-protocol-logo.png` | Public R2, key `renaissProtocolLogo` |
| T-shirt physics development copy | `src/assets/merch/renaiss-tshirt-physics.glb` | Local development only |
| T-shirt 3D source of truth | `private/merch/products/shirt/source/3d/` | Private self-contained source and recovery package |

Shared workbench files are split into `backgrounds/`, `branding/`,
`packaging/`, and `ui-screenshots/`. They are references and experiments, not
runtime candidates.

The two tracked brand logos are clearly separated as website inputs. The
current UI, legacy UI, and favicon all resolve them through the same versioned
public R2 release, so the production bundle must not contain either PNG.

## Deletion review

The initial organization did not delete media. After a separate explicit user
instruction on 2026-08-09, six confirmed-wrong images were deleted using exact
paths after reference checks. One merely superseded Bracelet image remains
retained. The complete record is in `media/ASSET_DELETE_REVIEW.md`.

## Required workflow

1. Read this index and both release manifests.
2. Compare source material with the current `website` input before replacing
   anything.
3. Preserve all product-detail images even when they are not published.
4. Reuse a canonical source when it fits. Generate only when the inventory has
   no suitable asset.
5. Put new AI candidates in `work/generated-images/<date-or-task>/` until the
   user chooses which files to retain.
6. Move approved generated files into the relevant product's `source` or
   `workbench` directory; never leave adopted media in a generic generation
   bucket.
7. Publish public Store derivatives and the four reveal MP4s through
   `npm run assets:publish`; publish gated product images through
   `npm run assets:private:publish`.
8. Verify the live R2/CDN response headers and MP4 range behavior before a
   production deployment.
