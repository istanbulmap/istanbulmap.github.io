# Istanbul Navigator

A production-ready offline-capable map app for Istanbul, Turkey. Built with React, TypeScript, Leaflet, and Tailwind CSS.

Live: [https://hassanireza.github.io/istanbulMap](https://hassanireza.github.io/istanbulMap)

## Features

- **Interactive Map** -- Dark-styled OpenStreetMap tiles with offline caching via PWA service worker
- **Route Planning** -- Set start and end points on the map; get transport suggestions for metro, tram, bus, ferry, funicular, and walking
- **Pins** -- Drop pins anywhere with custom labels, notes, and colors. Mark pins as favorites
- **Favorites** -- Save named locations by category. Quick-add Istanbul landmarks
- **Notes** -- Write travel notes linked to locations or standalone
- **Data Portability** -- Export all your data as a JSON file and import it next time to restore everything
- **PWA / Offline** -- Tiles cache automatically on first visit for offline use

## Tech Stack

- React 18 + TypeScript
- Vite + vite-plugin-pwa
- Leaflet + react-leaflet
- Tailwind CSS
- GitHub Actions + GitHub Pages

## Getting Started

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## Deployment

Push to `main` branch -- GitHub Actions builds and deploys automatically to GitHub Pages.

Before first deploy, enable GitHub Pages in your repo settings:
- Go to Settings > Pages
- Set Source to "GitHub Actions"

## Data Format

Exported JSON follows this schema:

```json
{
  "version": "1.0.0",
  "exportedAt": "ISO date",
  "pins": [...],
  "savedRoutes": [...],
  "favoriteLocations": [...],
  "notes": [...]
}
```

Import merges your file with existing session data -- no data is overwritten.

## Istanbul Transit Guide

| Mode | Network | Card |
|------|---------|------|
| Metro | M1-M12, Marmaray | Istanbulkart |
| Tram | T1 (European), T3 (Asian) | Istanbulkart |
| Bus | IETT | Istanbulkart |
| Ferry | IDO / Sehir Hatlari | Istanbulkart / cash |
| Funicular | F1 Kabatas-Taksim | Istanbulkart |

The Istanbulkart contactless card works on all public transport and saves money over single tickets.
