# Renaiss Merch Asset Index

Read this file before searching for or generating merch media. The `private/`
directory is intentionally ignored by Git, so its source assets will not
appear in default Git or ripgrep results.

## Lifecycle

| Class | Location | Purpose | Production rule |
| --- | --- | --- | --- |
| Source | `private/merch/source/<product>/` | Final masters and untouched originals | Never ship in `public` or `dist` |
| Runtime private | `private/merch/runtime/<product>/` | Product-image inputs for `private-asset-release.json`; canonical MP4 inputs for the public reveal release | Product images stay private; the four reveal MP4s publish publicly by explicit product decision |
| Runtime public | `src/assets/merch/storefront/` | Inputs for `public-asset-release.json` | Publish as versioned AVIF to public R2 |
| Archive | `private/merch/archive/<product>/` | Superseded recoverable versions | Never publish |
| Workbench | `private/merch/workbench/` | Extracted frames, experiments, and 3D research | Never publish |

## Bracelet

| Role | Canonical file | Delivery |
| --- | --- | --- |
| Gold master | `private/merch/source/bracelet/stills/bracelet-gold.png` | Source only |
| Gold generated variant | `private/merch/source/bracelet/stills/bracelet-gold-generated.png` | Source only |
| Silver master | `private/merch/source/bracelet/stills/bracelet-silver.png` | Source only |
| Silver generated variant | `private/merch/source/bracelet/stills/bracelet-silver-generated.png` | Source only |
| Silver cutout | `private/merch/source/bracelet/stills/bracelet-silver-cutout.png` | Source only |
| Closed box master | `private/merch/source/bracelet/stills/box-closed.png` | Source only |
| Approved horizontal Store master | `private/merch/source/bracelet/stills/box-closed-storefront.png` | Source only |
| Open box master | `private/merch/source/bracelet/stills/box-open.png` | Source only |
| Unrevealed Store image | `src/assets/merch/storefront/bracelet-box-closed.png` | Public R2, key `braceletSealedDrop` |
| Approved generation output provenance | `private/merch/workbench/generated/bracelet/box-closed-horizontal-ai-candidate-20260805.png` | Workbench only |
| Superseded deterministic horizontal composite | `private/merch/archive/bracelet/stills/box-closed-storefront-deterministic-horizontal-superseded-20260805.png` | Archive only |
| Rejected generated Store composite | `private/merch/archive/bracelet/stills/box-closed-storefront-color-rejected-20260805.png` | Archive only |
| Gold runtime product image | `private/merch/runtime/bracelet/product-gold.png` | Private R2 |
| Silver runtime product image | `private/merch/runtime/bracelet/product-silver.png` | Private R2 |
| Runtime Store cover | `private/merch/runtime/bracelet/store-cover.png` | Private R2 |
| Forward reveal | `private/merch/runtime/bracelet/reveal-forward.mp4` | Public versioned R2/CDN MP4, anonymously preloaded |
| Reverse reveal | `private/merch/runtime/bracelet/reveal-reverse.mp4` | Public versioned R2/CDN MP4, anonymously preloaded |
| Original forward video | `private/merch/source/bracelet/video/reveal-forward-original-20260728-105601.mp4` | Source only |
| Archived forward video | `private/merch/archive/bracelet/video/reveal-forward-20260728-095420.mp4` | Archive only |
| Archived reverse video | `private/merch/archive/bracelet/video/reveal-reverse-20260728-095420.mp4` | Archive only |

The unrevealed Bracelet card uses the approved horizontal generated master,
created from the physical closed-box and canonical pastel-grid references.
The physical master remains untouched, the generation output remains in
Workbench as provenance, and the superseded deterministic version remains in
Archive. `public-asset-release.json` records the approved image as the public
source master, and the asset pipeline fails when the runtime source does not
have the same SHA-256.

## T-shirt

| Role | Canonical file | Delivery |
| --- | --- | --- |
| Runtime product image | `private/merch/runtime/shirt/product.png` | Private R2 |
| Forward reveal | `private/merch/runtime/shirt/reveal-forward.mp4` | Public versioned R2/CDN MP4, anonymously preloaded |
| Reverse reveal | `private/merch/runtime/shirt/reveal-reverse.mp4` | Public versioned R2/CDN MP4, anonymously preloaded |
| Unrevealed card image | `src/assets/merch/storefront/shirt-box-card.jpg` | Public R2, key `sealedDrop` |
| Unrevealed catalog image | `src/assets/merch/storefront/shirt-box-catalog.png` | Public R2, key `sealedDropCatalog` |

## Storefront

| Role | Canonical file | Delivery |
| --- | --- | --- |
| Store background | `src/assets/merch/storefront/store-background.png` | Public R2, key `storeBackground` |
| T-shirt physics development copy | `src/assets/merch/renaiss-tshirt-physics.glb` | Local development only |
| T-shirt 3D source-of-truth | `private/3d/renaiss-tshirt/` | Private source and recovery package |

## Workbench

- Extracted and generated stills: `private/merch/workbench/extracted/`
- Bracelet 3D research v1: `private/merch/workbench/bracelet-3d/v1/`
- Bracelet 3D research v3: `private/merch/workbench/bracelet-3d/v3/`

Workbench files are evidence and experiments, not runtime candidates.

## Required workflow

1. Read this index and both release manifests.
2. Search with ignored files included when inspecting local source media:
   `rg --files -uu private/merch`.
3. Compare stills with the first and last frames of the corresponding reveal
   video.
4. Reuse the canonical source when it fits. Generate only when the inventory
   has no suitable asset.
5. Publish public Store derivatives and the four reveal MP4s through
   `npm run assets:publish`; publish gated product images through
   `npm run assets:private:publish`.
6. The public R2 `r2.dev` base is an approved delivery origin for the public
   Store stills and four reveal MP4s in either storefront mode. A custom
   Cloudflare domain is an optional future hardening step for custom cache and
   traffic rules, not a release gate.
7. Verify the live R2 response headers and MP4 range behavior before
   production deployment.
