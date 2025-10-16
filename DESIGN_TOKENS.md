# SproutML Design Tokens — Quick Reference

## 🎨 Color Palette

### Light Mode
```css
/* Primary */
--accent: #22C55E          /* SproutML Green - CTAs, success */
--accent-soft: #E8F8ED     /* Green tint backgrounds */
--accent-hover: #16A34A    /* Darker green for hover */

/* Backgrounds */
--bg: #FAFBFC             /* Page background */
--surface: #FFFFFF        /* Cards, panels */
--surface-elevated: #FFFFFF

/* Text */
--text: #0B0E14           /* Primary text (slate-900) */
--text-secondary: #475569 /* Secondary text (slate-600) */
--muted: #7B8395          /* Muted text, labels */

/* Borders */
--border-color: #E2E8F0   /* Slate-200 */
--border-subtle: #F1F5F9  /* Slate-100 */
```

### Dark Mode
```css
/* Primary */
--accent: #22C55E          /* Same green */
--accent-soft: rgba(34, 197, 94, 0.15)
--accent-hover: #16A34A

/* Backgrounds */
--bg: #0B0E14             /* Deep slate */
--surface: #101522        /* Card background */
--surface-elevated: #1A1F2E

/* Text */
--text: #E8ECF6           /* Light text */
--text-secondary: #94A3B8 /* Slate-400 */
--muted: #7B8395

/* Borders */
--border-color: rgba(226, 232, 240, 0.1)
--border-subtle: rgba(226, 232, 240, 0.05)
```

---

## 📐 Spacing Scale

```css
/* Base: 4px unit */
1 = 4px    /* Tight spacing */
2 = 8px    /* Icon gaps */
3 = 12px   /* Button padding */
4 = 16px   /* Card internal padding */
6 = 24px   /* Section spacing */
8 = 32px   /* Card padding */
12 = 48px  /* Major sections */
16 = 64px  /* Hero spacing */
```

---

## 🔤 Typography Scale

### Font Family
```css
font-sans: Inter, ui-sans-serif, system-ui, sans-serif
font-mono: ui-monospace, 'Cascadia Code', Menlo, monospace
```

### Sizes & Weights
```css
/* Hero */
text-4xl: 2.25rem (36px)  font-bold (700)
text-5xl: 3rem (48px)     font-bold (700)

/* Headings */
text-xl: 1.25rem (20px)   font-semibold (600)
text-lg: 1.125rem (18px)  font-semibold (600)

/* Body */
text-base: 1rem (16px)    font-normal (400)
text-sm: 0.875rem (14px)  font-medium (500)
text-xs: 0.75rem (12px)   font-medium (500)
```

---

## 🎭 Border Radius

```css
rounded-lg: 0.75rem (12px)   /* Inputs, small buttons */
rounded-xl: 1rem (16px)      /* Buttons, pills */
rounded-2xl: 1.5rem (24px)   /* Cards, dropzone */
```

---

## 🌫️ Shadow System

```css
/* Subtle */
shadow-sm: 0 1px 2px rgba(0,0,0,0.05)

/* Cards */
shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 
           0 4px 6px -4px rgba(0,0,0,0.1)

/* Interactive */
shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1), 
           0 8px 10px -6px rgba(0,0,0,0.1)

/* Colored (accent green) */
shadow-green-500/30: 0 10px 15px rgba(34,197,94,0.3)
shadow-green-500/40: 0 20px 25px rgba(34,197,94,0.4)
```

---

## ⏱️ Animation Durations

```css
/* Quick */
duration-200: 200ms  /* Hover, button states */

/* Standard */
duration-300: 300ms  /* Card reveals, tabs */

/* Slow */
duration-500: 500ms  /* Page sections, major transitions */

/* Easing */
ease: cubic-bezier(0.4, 0, 0.2, 1)
ease-in-out: cubic-bezier(0.4, 0, 0.6, 1)
```

---

## 🔘 Button Variants

### Default (Primary)
```tsx
className="bg-[#22C55E] text-white shadow-lg shadow-green-500/30 
           hover:bg-[#16A34A] hover:shadow-xl hover:scale-[1.02]"
```

### Outline
```tsx
className="border-2 border-slate-200 bg-white hover:bg-slate-50 
           hover:border-slate-300 text-slate-700"
```

### Ghost
```tsx
className="hover:bg-slate-100 text-slate-700"
```

---

## 📊 Component Patterns

### Card
```tsx
<div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200/60">
  {/* content */}
</div>
```

### Success Card
```tsx
<div className="bg-gradient-to-br from-green-50 to-emerald-50 
                rounded-2xl p-8 border border-green-200/50 shadow-lg">
  {/* content */}
</div>
```

### Processing Card
```tsx
<div className="bg-gradient-to-br from-blue-50 to-indigo-50 
                rounded-2xl p-8 border border-blue-200/50">
  {/* content */}
</div>
```

---

## 🎨 Gradient Backgrounds

### Hero
```tsx
className="bg-gradient-to-br from-slate-50 via-green-50/30 to-emerald-50/40"
```

### Success
```tsx
className="bg-gradient-to-br from-green-50 to-emerald-50"
```

### Processing
```tsx
className="bg-gradient-to-br from-blue-50 to-indigo-50"
```

---

## 🎬 Framer Motion Presets

### Fade In
```tsx
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.5 }}
```

### Scale Pop
```tsx
initial={{ scale: 0.9, opacity: 0 }}
animate={{ scale: 1, opacity: 1 }}
transition={{ duration: 0.2 }}
```

### Spring
```tsx
initial={{ scale: 0 }}
animate={{ scale: 1 }}
transition={{ type: "spring", stiffness: 200, damping: 15 }}
```

### Hover Lift
```tsx
whileHover={{ y: -4, scale: 1.02 }}
whileTap={{ scale: 0.98 }}
```

---

## 🎯 Icon Usage (Lucide React)

```tsx
/* Import */
import { Upload, CheckCircle2, Sparkles, Download, 
         RefreshCw, Target, TrendingUp, FileText, 
         Package, Code } from "lucide-react"

/* Size */
className="w-5 h-5"  // Standard (20px)
className="w-8 h-8"  // Large (32px)

/* Color */
className="text-[#22C55E]"  // Accent
className="text-slate-600"  // Muted
```

---

## 📱 Responsive Breakpoints

```css
/* Mobile first */
sm: 640px   /* Small tablets */
md: 768px   /* Tablets */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
```

### Usage Example
```tsx
className="text-4xl md:text-5xl"           // Responsive text
className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"  // Grid
```

---

## 🎨 Status Colors

```css
/* Success */
green: #22C55E (text, bg, border)
green-50: #E8F8ED (light bg)

/* Error */
red-600: #DC2626 (text)
red-50: #FEF2F2 (light bg)

/* Processing */
blue-600: #2563EB (text)
blue-50: #EFF6FF (light bg)

/* Warning */
yellow-600: #CA8A04
yellow-50: #FEFCE8
```

---

## 🔗 Usage in Code

```tsx
// Import tokens (conceptual)
import { colors, spacing, shadows } from './design-tokens'

// Or use Tailwind classes directly
<div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200/60">
  <h3 className="text-lg font-semibold text-slate-900 mb-6">Title</h3>
  <button className="bg-[#22C55E] text-white px-8 py-4 rounded-xl 
                     shadow-lg shadow-green-500/30 hover:bg-[#16A34A]">
    Action
  </button>
</div>
```

---

*Last updated: October 16, 2025*
*SproutML Design System v2.0*
