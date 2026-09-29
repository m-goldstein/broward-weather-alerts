# Tidewatch · wave over the Broadwalk

The giant curling wave, paved brick Broadwalk, palms, and low-rise coastal buildings connect the identity to Hollywood Beach. The illustration is branding, not a depiction of current flood conditions. The wave/palm/Broadwalk favicon is a simplified, editable SVG designed to remain recognizable at small sizes.

## Files

- `broadwalk-wave-source.png`: preserved original green illustration created with the built-in imagegen tool.
- `broadwalk-wave-blue-source.png`: blue palette edit used by the current dashboard and asset build.
- `public/brand/wave-broadwalk-mark.svg`: editable square logo mark and SVG favicon.
- `public/brand/tidewatch-wordmark.svg`: editable wordmark with the Hollywood Beach location.
- `public/brand/broadwalk-wave.webp`: optimized 1200×800 dashboard illustration.
- `public/brand/social-card.png`: 1200×630 social sharing graphic.
- `public/brand/favicon-{16,32,48}.png` and `public/favicon.ico`: browser favicon variants.
- `public/brand/apple-touch-icon.png`: 180×180 Apple icon.
- `public/brand/icon-{192,512}.png`: web app icons.

All paths under `public/` are relative to the project root. Re-export raster sizes and share artwork with `npm run brand:assets`. This command uses the saved source illustration; it does not call an AI service.

Current palette: navy `#102a43`, ocean blue `#2563b8`, azure `#3480cf`, sky `#9fc6e8`, ice `#edf4fb`, and warm sand. The original green source remains available for reference. Typography: Manrope for headings; DM Sans for interface text.

## Imagegen prompt

Use case: logo-brand. Asset type: premium weather dashboard brand illustration, wide landscape 1536x1024. Primary request: a giant curling ocean wave washing over the Hollywood Beach Broadwalk in Hollywood, Florida. Scene: an unmistakable seaside paved brick promenade running diagonally into the distance, a few palm trees alongside the promenade and understated low-rise coastal buildings, with a huge curling teal ocean wave sweeping onto the Broadwalk from the ocean. Make the Broadwalk visibly a paved brick pedestrian promenade, not a wooden boardwalk. Style: sophisticated flat editorial illustration with crisp vector-like shapes, gentle paper grain, beautiful restrained coastal palette that matches an existing sage-green dashboard: deep forest green #315341, ocean teal #518d77, seafoam #a8c8b4, pale sage #eaf0df, sand cream #f3e7bf. Composition: one cohesive full-bleed illustration, ocean wave is the dominant silhouette on the right, promenade and two stylized palms on the left and foreground. A giant wave washing over the walkway is essential. Calm sophisticated visual identity despite dramatic subject. No people, no injuries, no photorealistic disaster, no text, no lettering, no watermark, no chart, no UI. This is illustrative branding, not a documentary weather photograph.


## Blue palette edit prompt

Edit target: the provided Tidewatch brand illustration of a giant wave washing over the Hollywood Beach Broadwalk. Change only the color palette from green/sage/teal into a coherent blue weather-app identity: deep navy #102a43 for the darkest wave and palm silhouettes, ocean blue #2563b8, clear azure #3480cf, sky blue #9fc6e8, pale ice blue #edf4fb for the sky and bright foam. Keep the promenade in a restrained warm sand tone and foam softly cream-white. Preserve the giant curling wave, its shape, the paved brick Broadwalk, the palms, coastal buildings, composition, editorial illustration style, detail, texture, and aspect ratio exactly. No green tones. No text, logos, watermarks, people, extra objects, or layout changes. This is branding artwork for an existing mobile-first tide and weather dashboard, not a weather photo.
