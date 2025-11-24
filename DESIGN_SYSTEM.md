# Job Tracker Design System

## Overview
This document describes the design system and aesthetic enhancements applied across the Job Tracker application.

## Typography

### Fonts
- **Body Text**: DM Sans (weights: 400, 500, 700)
- **Headlines**: Archivo (weights: 600, 700, 800)

### Usage
```tsx
import { DM_Sans, Archivo } from 'next/font/google'

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '700'] })
const archivo = Archivo({ subsets: ['latin'], weight: ['600', '700', '800'] })
```

## Color Palette

### Primary Colors
- **Slate**: Main UI colors (50, 100, 200, 300, 400, 500, 600, 800, 900)
- **Indigo**: Accent color (400, 500, 600)
- **Violet**: Secondary accent (500, 600, 700)

### Status Colors
- **Emerald/Green**: Success, growth, opportunity (50, 100, 200, 300, 700)
- **Violet/Purple**: Energy, progress, premium (50, 100, 300, 500, 600, 700)
- **Sky Blue**: Confidence, professionalism (50, 200, 700)
- **Amber**: Caution (not negative) (50, 200, 300, 700, 800)
- **Slate**: Neutral/inactive states (100, 200, 300, 600, 800)

## Status Badge System

### Job Application Statuses
Located in: `src/app/globals.css`

```css
.status-badge {
  @apply px-3 py-1 rounded-full text-xs font-medium transition-all duration-200;
}

.status-bookmarked { @apply bg-blue-50 text-blue-700 border border-blue-200; }
.status-interested { @apply bg-emerald-50 text-emerald-700 border border-emerald-200; }
.status-applied { @apply bg-sky-50 text-sky-700 border border-sky-200; }
.status-interviewing {
  @apply bg-violet-50 text-violet-700 border border-violet-300;
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
}
.status-offered {
  @apply bg-green-50 text-green-700 border border-green-300;
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.15);
  font-weight: 600;
}
.status-onhold { @apply bg-amber-50 text-amber-700 border border-amber-200; }
.status-rejected { @apply bg-slate-100 text-slate-600 border border-slate-200; }
.status-withdrawn { @apply bg-slate-100 text-slate-600 border border-slate-200; }
.status-noresponse { @apply bg-slate-100 text-slate-600 border border-slate-200; }
```

### Color Psychology
- **Green/Emerald** = Success, achievement
- **Violet** = Energy, progress, premium feeling
- **Sky Blue** = Confidence, professionalism
- **Amber** = Caution (but not negative)
- **Slate** = Neutral/completed states

## Interactive Elements

### Hover Effects

#### Card Lift Pattern
```tsx
className="hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
```

#### Subtle Lift Pattern
```tsx
className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
```

#### Accent Stripe Pattern
Used in tables on hover:
```tsx
<div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-r" />
```

### Button Styles

#### Primary Action Button
```tsx
className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
```

#### Secondary Button
```tsx
className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors duration-200"
```

## Modal System

### Modal Headers

**General Purpose Modals** (Jobs, Contacts):
```tsx
className="bg-gradient-to-br from-slate-900 to-slate-700 px-4 py-3 text-white flex-shrink-0 border-b-2 border-slate-600"
```

**Interaction/Activity Modals**:
```tsx
className="bg-gradient-to-br from-emerald-600 to-green-700 px-4 py-3 text-white border-b-2 border-emerald-600"
```

**Reminder Modals**:
```tsx
className="bg-gradient-to-br from-violet-600 to-purple-700 px-4 py-3 text-white border-b-2 border-violet-600"
```

### Modal Slide-in Animation
All modals use:
```tsx
className="fixed top-0 right-0 h-full w-full md:w-[700px] lg:w-[800px] bg-white shadow-2xl pointer-events-auto transform transition-transform duration-300 ease-out animate-slide-in-right overflow-hidden flex flex-col"
```

## Tab Navigation

### Active Tab Indicators
Gradient accent bars beneath active tabs:
```tsx
{isActive && (
  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 rounded-full shadow-sm" />
)}
```

### Active Tab Icon Background
```tsx
className={isActive
  ? 'bg-gradient-to-br from-slate-900 to-slate-700 shadow-lg'
  : 'bg-slate-100 group-hover:bg-slate-200'
}
```

## Borders

### Standard Pattern
- Default: `border-2 border-slate-200`
- Hover: `hover:border-slate-300`
- Active/Selected: `border-slate-900`

### Visual Hierarchy
- 2px borders throughout for clear visual definition
- Rounded corners: `rounded-lg`, `rounded-xl`, `rounded-2xl`

## Animations

### Standard Transitions
```css
transition-all duration-200
```

### Animation Classes
Located in `src/app/globals.css`:
- `animate-slide-in-right` - Modal slide-in from right
- `animate-fade-in` - Fade in effect
- `animate-slide-up` - Slide up effect
- `animate-scale-in` - Scale in effect

## Component-Specific Patterns

### Contact Cards (Network Tab)
```tsx
<div className="bg-white border-2 border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group">
  <div className="w-8 h-8 bg-slate-900 group-hover:bg-indigo-600 rounded-full transition-colors duration-200">
    {/* Avatar */}
  </div>
</div>
```

### Job Table Rows
```tsx
<tr className="hover:bg-slate-50/50 group relative transition-all duration-200">
  <td className="px-4 py-3 relative">
    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-r" />
    {/* Content */}
  </td>
</tr>
```

### Stats Cards (Reporting)
```tsx
<div className="bg-white/60 backdrop-blur-sm rounded-xl border-2 border-slate-200 shadow-sm p-4 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group">
  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-200">
    {/* Icon */}
  </div>
</div>
```

## Implementation Notes

### Files Modified
- `src/app/globals.css` - Status badge colors and animations
- `src/app/page.tsx` - Main dashboard tabs and navigation
- `src/components/JobList.tsx` - Job pipeline with hover effects
- `src/components/ContactList.tsx` - Network tab with card animations
- `src/components/Reporting.tsx` - Stats cards and table interactions
- `src/components/CSVManager.tsx` - Data hub card hover effects
- `src/components/JobForm.tsx` - Modal styling and status buttons
- `src/components/ContactForm.tsx` - Modal styling
- `src/components/JobContactManager.tsx` - Contact linking interface
- `src/components/ReminderDetailsModal.tsx` - Reminder viewing
- `src/components/modals/CreateReminderModal.tsx` - Reminder creation
- `src/components/LandingPageV2.tsx` - Landing page with preview

### Consistency Principles
1. **2px borders** for visual clarity
2. **200ms transitions** for smooth interactions
3. **Gradient accents** for visual interest without overwhelming
4. **Meaningful colors** that communicate state and emotion
5. **Lift and shadow** on hover for tactile feedback
6. **Group hover patterns** for coordinated component interactions

## Accessibility

### Color Contrast
All text colors meet WCAG AA standards:
- Text on white: `text-slate-900`, `text-slate-700`, `text-slate-600`
- Text on colored backgrounds: Sufficient contrast maintained

### Interactive States
- Hover states provide visual feedback
- Focus states use browser defaults + custom rings
- Disabled states use `opacity-50` and `cursor-not-allowed`

### Motion
- Animations use `transition-all duration-200` for smooth, quick feedback
- No animations longer than 300ms to avoid user frustration
- Respects `prefers-reduced-motion` (browser default)

## Future Considerations

### Potential Enhancements
- Dark mode support using CSS variables
- Additional status states for jobs/contacts
- More granular color customization
- Theme switching capability

### Maintenance
- Keep color palette centralized
- Document any new patterns added
- Test hover states on all interactive elements
- Ensure consistency across new components

---

**Last Updated**: November 2024
**Version**: 1.0
