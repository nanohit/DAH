# Fonts Directory

This directory is for hosting custom fonts. The Geometria font is used as the primary font throughout the application.

## Required Font Files (Optional)

If you have the Geometria font files, place them here:

- `Geometria-Light.woff2` / `Geometria-Light.woff` / `Geometria-Light.ttf`
- `Geometria-Regular.woff2` / `Geometria-Regular.woff` / `Geometria-Regular.ttf`
- `Geometria-Medium.woff2` / `Geometria-Medium.woff` / `Geometria-Medium.ttf`
- `Geometria-Bold.woff2` / `Geometria-Bold.woff` / `Geometria-Bold.ttf`

## Fallback

If Geometria fonts are not available:
1. The system will first try to load from the local system fonts
2. Then fall back to Manrope (loaded from Google Fonts)
3. Finally, system fonts (-apple-system, BlinkMacSystemFont, etc.)

The fallback chain ensures the UI looks good even without the Geometria font files.


