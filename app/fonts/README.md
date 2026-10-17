# Fonts

Kiln ships its fonts so it works offline and never calls a font service.

- `fonts.css` + `*.woff2`: Inter, Geist, Manrope, IBM Plex Sans, IBM Plex Mono, Courier Prime — SIL Open Font
  License 1.1 (`licenses/`). Latin, Latin Extended and Cyrillic subsets, as served by Google Fonts.
- **Satoshi** (optional, Settings → Font): its licence, the ITF Free Font License, doesn't allow it in a public
  repository, so it isn't here. To use it, download Satoshi from https://www.fontshare.com/fonts/satoshi and copy
  `Satoshi-Regular.woff2`, `Satoshi-Medium.woff2` and `Satoshi-Bold.woff2` (from `Fonts/WEB/fonts`) into
  `app/fonts/satoshi/` with this `satoshi.css`:

```css
@font-face{font-family:'Satoshi';src:url(Satoshi-Regular.woff2) format('woff2');font-weight:400;font-display:swap}
@font-face{font-family:'Satoshi';src:url(Satoshi-Medium.woff2) format('woff2');font-weight:500;font-display:swap}
@font-face{font-family:'Satoshi';src:url(Satoshi-Bold.woff2) format('woff2');font-weight:700;font-display:swap}
```

  Without it, Kiln uses Geist.
