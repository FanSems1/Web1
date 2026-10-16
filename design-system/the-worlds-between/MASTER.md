# The Worlds Between — Design Master (v2)

v1 (soft "clay" 3D + editorial reading panels, from ui-ux-pro-max) was rejected by the client:
it did not resemble the reference. v2 is derived directly from studying The Monolith Project
in the browser: its visual language and pacing, not its assets or story.

## Language
- **Hand-drawn film.** 3D rendered as illustration: dark ink outlines (normal/depth edges),
  three-band cel shading, paper grain, lines that "boil" at 8 fps.
- **One continuous camera flight.** Scroll moves the camera; every transition flies *into*
  an object (doorway → sky; cloud sea → reef; ship porthole → gallery; last arch → white).
- **One dominant colour per world**: paper `#E8E0CF` · sky `#A9CBDC` · sage `#93AA82` ·
  terracotta `#D9A291` · white `#F2EEE6`. (03 is now The Coral Deep, sea `#5FAFC4`, replacing the gear garden.)
- **Torn gold titles**: Rubik 900, gold `#F2C14E`, ink stroke + hard ink shadow, letters
  cut into three paper strips that assemble and tear away with scroll.
- **Captions, not panels**: Barlow Condensed 600–700 uppercase, short, in corners; words
  slide up one by one. Details live in overlays.
- **Near-invisible chrome**: spark (index) top-left · chapter + progress bottom-centre ·
  Calm bottom-left · Index bottom-right.
- **Ink components**: paper fill, 2.5px ink border, hard 3–4px ink shadow, gold buttons.

## Rules
- Text over busy scenes on mobile sits on paper cards; anchored labels dock on mobile.
- Every interaction optional; keyboard + screen-reader paths for all content.
- Do not copy the reference's models, characters, story, loader or branding.

## Rendering decisions (measured)
- Two scene passes + one composite; one mounted world; parallel shader compile; three.js
  loaded after window `load`; loader never covers the first headline.
