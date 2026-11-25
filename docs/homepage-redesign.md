# MAVS.KR homepage

The homepage is a single-screen entrance with an original MAVS.KR vector wordmark, a WebGL fluid reveal, and links to the archive and social channels. The generated hardwood image and existing Dallas artwork are separate layers.

- Archive: `/stat`, English archive: `/stat/en`.
- Instagram: `https://www.instagram.com/mavs.kr/`.
- YouTube: set `NEXT_PUBLIC_MAVS_YOUTUBE_URL` to the owner's HTTPS YouTube channel URL. Until supplied, the link opens the existing `/fan?tab=podcast` video hub. No third-party channel is presented as the owner's channel.
- Wordmark: original SVG geometry based on the reference's dense proportions. The reference logo is outlined SVG; its original font is unconfirmed. PP Neue Montreal was identified in the reference's body CSS, but no unlicensed font files are copied or embedded. Current homepage UI uses system Helvetica/Arial and the existing Korean font.
- Reduced motion / unsupported WebGL: complete static homepage, with all navigation available.
- Pointer trails decay; rendering stops when settled and pauses when the page is hidden.
- No new packages or remote runtime scripts are required.

## Image provenance

Generated with the built-in GPT Image tool. Source: `public/images/home/dallas-court-source.png`. Delivery asset: `public/images/home/dallas-court.webp` (1672 × 941). Dallas logo: existing `public/images/logos/mavericks.svg`.

Final generation prompt:

```text
Use case: photorealistic-natural
Asset type: Full-bleed basketball court floor texture for an interactive Dallas Mavericks fan homepage, landscape 16:9, high resolution.
Primary request: A cinematic but clean overhead photograph of a pristine Dallas-blue basketball court's center court, viewed perfectly straight down. Warm pale honey maple wood parquet strips running horizontally, subtle realistic varnish reflections, cobalt blue half-court line vertically through center, a crisp thin cobalt blue center circle. Empty center circle, leave it completely unmarked so an official Dallas Mavericks logo can be composited there separately. The center circle occupies approximately 45 percent of the frame height. Court floor fills every edge with blue boundary details at the far left and right. Bright editorial sports photography, tactile subtle grain, restrained luxury art direction, natural even arena lighting with a slightly darker blue tint at the far edges. No perspective vanishing point, no people, no ball, no seats, no stadium, no watermark, no typography, no invented team logos. The image must feel like standing above the actual hardwood, not a diagram or illustration.
```

The reference is https://www.noth.in/. The site's HTML, CSS and JS were inspected; its code and media are not embedded in this implementation. Motion and rendering are implemented in project-owned shaders. Pixel-identical font matching remains unverified until the original logo font is identified.

## Verification

- Records tests: 71 passed, including archive URL generation and legacy URL mapping.
- TypeScript: `tsc --noEmit --incremental false` passed.
- Production build: `npm run build` passed. Existing record-cache queries logged database statement timeouts, which are tracked separately below.
- Chromium desktop (1440 × 1000) and mobile (390 × 844): no horizontal overflow or page JavaScript errors; WebGL became ready and screenshots confirmed the court and Dallas logo were revealed.
- Mobile vertical drag: pointer movement was delivered without pointer cancellation.
- Menu: first-link focus, Tab/Shift+Tab loop, Escape return to the menu button.
- Reduced motion: no fluid canvas; changing the preference on/off works without a reload.
- WebGL disabled: static wordmark and all three footer links remain visible.
- `/stat`, `/stat/en`, `/stat/players`, and `/stat/search?q=Dirk` rendered. Legacy player and English record URLs returned 308 with the query retained. Unknown archive paths show the archive 404 with `noindex`.
- Some existing records database queries timed out during live route checks. Routing and page rendering were checked, but live data availability is not fully verified. No database schema or production settings were changed.
- Physical iOS/Safari and deployment have not been tested.

Local review screenshots are in `output/home-review/`.
