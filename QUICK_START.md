# 🚀 Quick Start Guide - SproutML Redesign

## Run the Application

```bash
# Development mode
npm run dev

# Production build
npm run build
npm run start

# Lint check
npm run lint
```

The app will be available at `http://localhost:3000` (or the port shown in terminal).

## What Changed?

### Visual Design
- **Dark Theme**: Modern dark UI with #0B0E14 background
- **Inter Font**: Clean, professional typography
- **Smooth Animations**: Framer Motion with 200ms transitions
- **Green Accent**: #22C55E for CTAs and highlights

### User Experience
- **5-Step Flow**: Upload → Preview → Target → Train → Results
- **Progress Tracker**: Visual stepper showing current step
- **Real-time Updates**: Live training progress with polling
- **Data Visualization**: Charts and metrics in results

### New Components
- Cards, Badges, Progress bars, Separators
- Data table with TanStack Table
- Results charts with Recharts  
- Loading animations and stats cards
- Custom 404 page

## Key Files

```
app/
├── globals.css          # Dark theme design system
├── layout.tsx           # Inter font setup
├── page.tsx             # Main redesigned interface (25KB!)
└── not-found.tsx        # Custom 404 page

components/
├── ui/                  # shadcn/ui components
├── data-table.tsx       # Table component
├── results-charts.tsx   # Chart visualizations
├── loading-dots.tsx     # Animated loader
└── stats-card.tsx       # Metric cards
```

## User Flow

1. **Upload CSV**: Drag-and-drop or click to upload
2. **Preview Data**: See first 10 rows in interactive table
3. **Select Target**: Click column to set as prediction target
4. **Train Model**: Watch real-time progress updates
5. **View Results**: See metrics, charts, download artifacts

## Color Palette

```css
Background:  #0B0E14  /* Dark base */
Surface:     #101522  /* Cards */
Text:        #E8ECF6  /* High contrast */
Accent:      #22C55E  /* Green CTAs */
Border:      rgba(232,236,246,0.1)  /* Subtle */
```

## Animation Timing

- Page transitions: 200ms
- Button hover: 150ms
- Card entrance: 300ms (with stagger)
- Progress bar: Smooth with easing

## Dependencies Added

```json
{
  "framer-motion": "Animation library",
  "recharts": "Chart library",
  "@tanstack/react-table": "Table component",
  "@radix-ui/react-progress": "Progress bar",
  "@radix-ui/react-separator": "Dividers"
}
```

## Build Info

- ✅ Build: Successful
- ⚡ Build Time: ~4 seconds
- 📦 Bundle Size: 343 kB
- 🎯 Linting: 0 errors
- 🔒 TypeScript: All checks pass

## Testing the Flow

1. Start dev server: `npm run dev`
2. Open browser: `http://localhost:3000`
3. Upload a CSV file (drag or click)
4. Click through the 5-step wizard
5. Select a target column
6. Start training and watch progress
7. View results with charts and downloads

## Tips

- Use real CSV data for best experience
- Progress bar updates every 3-5 seconds
- All artifacts are downloadable
- Click "Train New Model" to reset

## Documentation

- `REDESIGN.md` - Full redesign documentation
- `IMPLEMENTATION_SUMMARY.md` - Technical summary
- `FEATURES.md` - Feature highlights
- `QUICK_START.md` - This file

## Support

If you encounter issues:
1. Check console for errors
2. Verify CSV file format
3. Ensure backend API is running
4. Check Node.js version (18+)

---

**Enjoy your redesigned SproutML! 🌱**
