# React Bits Magic Bento entrance adaptation

Source: https://reactbits.dev/r/MagicBento-TS-CSS.json
Retrieved: 2026-10-20, current public registry (not the older pinned snapshot).
Official page: https://reactbits.dev/c/components/magic-bento

The Hub adapts the intro's 760ms spring into a top-left to bottom-right widget entrance, followed by a separately staggered entrance for each heading, image, text block, row and action. Content uses individual CSS translate to preserve existing hero centering, scale and hover transforms. The requested downward arrival replaces upstream upward arrival. There is no sweep, wave or sheen. Layout, content, cursor effects, click waves, border glow, stars and demo artwork are not imported. No additional dependency is required.

Retrieval: shadcn MCP returned NOT_CONFIGURED for @react-bits. Official shadcn CLI view retrieved the item but truncated its large JSON output at 65536 bytes; the same official registry JSON was then read directly in full. No archived-code or runtime fallback is used.

## Upstream license

MIT + Commons Clause License Condition v1.0

Copyright (c) 2026 David Haz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, and distribute the Software **as part of an application, website, or product**, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

## Commons Clause Restriction

You may use this Software, including for any commercial purpose, **so long as you do not sell, sublicense, or redistribute the components themselves-whether alone, in a bundle, or as a ported version.**

The same restriction covers the React Bits tools (Background Studio, Texture Lab, Shape Magic, Center Stage, Sound Lab and any tools added later) and the sounds in the sound library. **You may not sell, sublicense, or redistribute the tools or the sounds themselves, or offer the tools or a substantially similar copy of them as a hosted service-whether alone, in a bundle, or as a ported version.**

What you make with the tools is yours to use. You can use exported code, images, videos, and audio files in any personal or commercial application, website, or product, including paid ones. **You may not sell or redistribute the exports on their own, either individually or as the product itself, such as a sound, texture, background, or template pack.**

## No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
