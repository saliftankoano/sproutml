# SproutML Redesign 🌱

## Overview

This redesign transforms SproutML into a modern, polished SaaS application inspired by Linear, Notion, and Runway. The interface now features a clean, dark theme with smooth animations and an intuitive multi-step workflow.

## 🎨 Design System

### Colors
- **Background**: `#0B0E14` - Deep, rich dark base
- **Surface**: `#101522` - Elevated card background  
- **Text**: `#E8ECF6` - Crisp, readable light text
- **Accent**: `#22C55E` - Vibrant green for CTAs and highlights
- **Borders**: `rgba(232, 236, 246, 0.1)` - Subtle, translucent borders

### Typography
- **Primary Font**: Inter - Modern, clean, and highly legible
- **Monospace**: Geist Mono - For code and data display
- **Font Rendering**: Antialiased for crisp text on all screens

### Design Principles
- **Balanced Layout**: Generous whitespace, consistent padding (6px grid system)
- **Subtle Depth**: Soft shadows and translucent borders for layering
- **Smooth Motion**: 200ms transitions with easing for all interactions
- **Clear Hierarchy**: Bold headings, muted descriptions, organized information

## 🚀 Key Features

### 1. Multi-Step Flow
The app now guides users through a clear 5-step process:

1. **Upload** - Drag-and-drop or click to upload CSV files
2. **Preview** - Interactive data table showing the first 10 rows
3. **Target** - Visual column selector with one-click selection
4. **Train** - Real-time progress with live updates
5. **Results** - Comprehensive metrics, charts, and downloadable artifacts

### 2. Modern UI Components

#### Progress Tracker
- Visual step indicator at the top of every page
- Animated progress bar connecting steps
- Check marks for completed steps
- Active state highlighting

#### Cards & Surfaces
- Rounded corners (12px border-radius)
- Subtle borders with gradient effects
- Hover states with smooth transitions
- Glass-morphism effects on header

#### Interactive Elements
- Animated buttons with hover/tap feedback
- Loading states with custom dot animations
- Badge components for status indicators
- Smooth page transitions using Framer Motion

### 3. Enhanced Data Visualization

#### Data Table (TanStack Table)
- Responsive, scrollable layout
- Formatted data types (numbers, nulls, strings)
- Clean row hover states
- Professional typography with monospace data

#### Charts (Recharts)
- Model performance bar charts
- Training progress line charts
- Responsive design with dark theme
- Smooth animations on load

#### Stats Cards
- At-a-glance metrics on results page
- Icon-based visual hierarchy
- Hover effects with gradient overlays
- Staggered entrance animations

### 4. Micro-Interactions

- **File Upload**: Drag-and-drop with visual feedback
- **Column Selection**: Scale animation on selection with checkmark
- **Training**: Animated loading dots and progress bar
- **Results**: Staggered card animations (50ms delays)
- **Downloads**: One-click artifact downloads with icons

### 5. Accessibility & Polish

- Semantic HTML structure
- ARIA labels where appropriate
- Keyboard navigation support
- Custom scrollbar styling
- Smooth scroll behavior

## 🛠 Tech Stack

### Core Framework
- **Next.js 15.5.2** - React framework with App Router
- **TypeScript** - Type-safe development
- **React 19.1.0** - Latest React features

### Styling
- **TailwindCSS 4** - Utility-first CSS framework
- **Custom CSS Variables** - Design token system
- **Framer Motion** - Animation library (~200ms transitions)

### UI Components
- **shadcn/ui** - Accessible component primitives
- **Radix UI** - Headless UI primitives (Progress, Separator)
- **Lucide React** - Modern icon set

### Data & Charts
- **TanStack Table** - Powerful table component
- **Recharts** - Declarative chart library
- **PapaParse** - CSV parsing

## 📁 File Structure

```
/workspace
├── app/
│   ├── globals.css          # Dark theme design system
│   ├── layout.tsx            # Root layout with Inter font
│   └── page.tsx              # Main redesigned interface
├── components/
│   ├── ui/                   # shadcn/ui components
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── progress.tsx
│   │   ├── separator.tsx
│   │   └── table.tsx
│   ├── data-table.tsx        # TanStack Table wrapper
│   ├── results-charts.tsx    # Recharts visualizations
│   ├── loading-dots.tsx      # Animated loader
│   └── stats-card.tsx        # Metric display cards
└── lib/
    └── utils.ts              # Utility functions
```

## 🎯 User Flow

### Upload Dataset
1. User sees clean landing with upload area
2. Drag-and-drop or click to select CSV file
3. File parsed in background (web worker)
4. Automatic transition to preview on success

### Preview & Select
5. Interactive table shows first 10 rows
6. User clicks "Continue" to proceed
7. Column selector displays all available columns
8. User clicks desired target column (visual feedback)

### Train Model
9. "Start Training" button triggers API call
10. Page transitions to training view
11. Real-time progress updates every 3-5 seconds
12. Live output from preprocessing/training displayed

### View Results
13. Success animation and metrics displayed
14. Stats cards show dataset overview
15. Charts visualize model performance
16. Artifacts listed with one-click downloads
17. "Train New Model" resets the flow

## 🌟 Visual Highlights

### Glass Morphism Header
- Backdrop blur effect
- Sticky positioning
- Semi-transparent background
- Animated logo with gradient

### Gradient Borders
- CSS utility class `.gradient-border`
- Pseudo-element technique
- Subtle green-to-blue gradient
- Applied to cards on hover

### Custom Scrollbar
- 8px width for comfort
- Matches dark theme colors
- Rounded thumb
- Hover state feedback

### Animation Patterns
- **Page Transitions**: Fade + slide (opacity + y-axis)
- **Card Entrance**: Staggered with 50-100ms delays
- **Loading States**: Bounce animation for dots
- **Hover States**: Scale 1.02-1.1 with smooth easing

## 🔧 Development

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Lint Code
```bash
npm run lint
```

## ✨ Future Enhancements

- Dark/light mode toggle
- Advanced filtering in data table
- More chart types (scatter, pie, heatmap)
- Export results as PDF/CSV
- Model comparison view
- Real-time collaboration features
- Keyboard shortcuts
- Theme customization

## 🎨 Color Palette Reference

```css
/* Base Colors */
--background: #0B0E14;        /* Deep dark base */
--surface: #101522;            /* Card background */
--foreground: #E8ECF6;         /* Text */

/* Accent Colors */
--primary: #22C55E;            /* Green accent */
--secondary: #1a1f2e;          /* Muted surface */
--muted: #8891a8;              /* Muted text */

/* Borders & Inputs */
--border: rgba(232,236,246,0.1);
--input: rgba(232,236,246,0.15);

/* Semantic Colors */
--destructive: #ef4444;        /* Errors */
--success: #22C55E;            /* Success states */
```

## 📊 Performance

- **First Load JS**: 288 kB (including all libraries)
- **Static Generation**: All pages pre-rendered
- **Build Time**: ~4 seconds with Turbopack
- **Animation FPS**: 60fps on modern devices

## 🎓 Design Inspiration

- **Linear**: Clean cards, subtle borders, professional feel
- **Notion**: Smooth interactions, intuitive UI patterns  
- **Runway**: Bold accent colors, modern typography, visual hierarchy

---

**Built with ❤️ and attention to detail**
