# UI Components Documentation

This document describes the custom UI components built for the Job Tracker application.

## Core UI Components

### ResizableTextArea

A text area component with drag-to-resize functionality using native browser resize handles.

**Location**: `src/components/ContactForm.tsx`, `src/components/ContactList.tsx`

**Props**:
```typescript
interface ResizableTextAreaProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  name?: string
  id?: string
  className?: string
  minHeight?: number  // Default: 100px
  maxHeight?: number  // Default: 400px
}
```

**Usage**:
```jsx
<ResizableTextArea
  value={description}
  onChange={(e) => setDescription(e.target.value)}
  placeholder="Enter description..."
  minHeight={80}
  maxHeight={300}
/>
```

**Features**:
- Native browser resize handle (diagonal lines in bottom-right corner)
- Configurable min/max height constraints
- Consistent styling with form inputs
- Accessible with proper ARIA labels

---

### BottomSheet

A mobile-optimized modal component that slides up from the bottom of the screen.

**Location**: `src/components/ui/BottomSheet.tsx`

**Props**:
```typescript
interface BottomSheetProps {
  children: ReactNode
  isOpen: boolean
  onClose: () => void
  title?: string
  className?: string
  snapPoints?: number[]     // Heights in pixels [100, 300, 600]
  defaultSnap?: number      // Index of snapPoints (default: 1)
  showHandle?: boolean      // Show drag handle (default: true)
}
```

**Usage**:
```jsx
<BottomSheet
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  title="Contact Details"
  snapPoints={[150, 400, 700]}
  defaultSnap={1}
>
  <ContactForm />
</BottomSheet>
```

**Features**:
- Multiple snap points for different heights (peek, half, full)
- Drag handle for intuitive interaction
- Backdrop blur and click-to-close
- Prevents body scroll when open
- Portal-based rendering to avoid positioning issues
- Touch and mouse event support

---

### ResizablePanel

A panel component with drag-to-resize functionality for layout adjustments.

**Location**: `src/components/ui/ResizablePanel.tsx`

**Props**:
```typescript
interface ResizablePanelProps {
  children: ReactNode
  defaultWidth?: number     // Default: 350px
  minWidth?: number        // Default: 250px  
  maxWidth?: number        // Default: 600px
  storageKey?: string      // LocalStorage key for persistence
  className?: string
  position?: 'left' | 'right'  // Default: 'right'
}
```

**Usage**:
```jsx
<ResizablePanel
  defaultWidth={400}
  minWidth={300}
  maxWidth={600}
  storageKey="sidebar-width"
  position="right"
>
  <SidebarContent />
</ResizablePanel>
```

**Features**:
- Drag handle with visual indicators (vertical dots)
- Width persistence in localStorage
- Keyboard support (Alt + Arrow keys)
- Smooth transitions and hover effects
- Configurable position (left/right)

---

### TruncatedText

A text component that truncates content and provides expand/collapse functionality.

**Location**: `src/components/ContactList.tsx`, `src/components/InteractionCard.tsx`

**Props**:
```typescript
interface TruncatedTextProps {
  text: string
  maxLines?: number        // Default: 2
  className?: string
  showToggle?: boolean     // Default: true
}
```

**Usage**:
```jsx
<TruncatedText
  text={longDescription}
  maxLines={3}
  showToggle={true}
  className="text-sm text-gray-700"
/>
```

**Features**:
- CSS line clamping with WebKit support
- Expand/collapse buttons with chevron icons
- Automatic truncation detection
- Smooth transitions
- Accessible with proper button labels

## Form Components

### Enhanced Input Styling

All form inputs use a consistent styling system defined in `src/app/globals.css`:

```css
.input {
  @apply w-full border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-700 
         placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 
         focus:border-blue-500 transition-all duration-200 bg-white/80 backdrop-blur-sm;
}

.form-label {
  @apply flex items-center text-sm font-semibold text-slate-700;
}

.form-group {
  @apply space-y-2;
}
```

**Features**:
- Consistent text size (`text-sm`)
- Reduced padding for compact design (`py-2`)
- Inline icon support in labels
- Focus states with ring and border color
- Glassmorphism background effects

### Contact Form Enhancements

**Recent Improvements**:
- Icons positioned inline with field labels (not stacked above)
- "Current role" checkbox moved inline with "End Date" label
- Reduced vertical spacing between form sections
- ResizableTextArea integration for description and notes fields
- Null value handling to prevent React warnings

## Modal Components

### ContactModal

Enhanced modal for displaying detailed contact information.

**Features**:
- Compact, data-dense layout with smaller fonts
- Resizable text areas for experience descriptions and notes
- Reduced padding and spacing for mobile optimization
- Color-coded sections with consistent iconography
- Inline action buttons (edit, close) in header

### Contact Management System

**Key Components**:
- `ContactList`: Main contact interface with search and filtering
- `ContactCard`: Compact contact preview cards  
- `ContactModal`: Detailed contact view with all information
- `ContactForm`: Create/edit contact form with validation

## Interaction Components

### InteractionCard

Displays individual interaction records with enhanced UX.

**Features**:
- Type-specific color coding and icons
- Smart date formatting (Today, Yesterday, relative dates)
- Expandable notes with TruncatedText
- Hover states with action buttons
- Compact and full display modes

### InteractionForm

Form for creating and editing interactions.

**Features**:
- Type selection with visual indicators
- Date picker integration
- ResizableTextArea for detailed notes
- Real-time validation
- Auto-save functionality

## Styling System

### Design Tokens

```css
:root {
  --primary-50: #eff6ff;
  --primary-500: #3b82f6;
  --slate-50: #f8fafc;
  --slate-700: #334155;
  /* Glass morphism effects */
  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-border: rgba(148, 163, 184, 0.2);
}
```

### Component Patterns

1. **Cards**: Rounded corners, subtle borders, hover effects
2. **Buttons**: Primary/secondary variants with consistent spacing
3. **Icons**: Lucide React icons with consistent sizing (w-3 h-3 for small, w-4 h-4 for medium)
4. **Typography**: Text hierarchy with sm/base/lg sizes
5. **Colors**: Slate-based neutral palette with blue accents

### Responsive Design

- **Mobile-first**: Bottom sheets and touch-optimized interfaces
- **Breakpoints**: Tailwind's standard breakpoints (sm, md, lg, xl)
- **Grid Systems**: CSS Grid and Flexbox for layout
- **Touch Targets**: Minimum 44px for interactive elements

## Animation and Transitions

### Micro-interactions
- Hover states on all interactive elements
- Scale transforms on card hover (`hover:scale-[1.02]`)
- Color transitions on state changes
- Loading states with skeleton screens

### Page Transitions
- Slide-up animations for modals
- Fade transitions for content changes
- Staggered animations for list items

## Accessibility

### ARIA Support
- Proper labeling on all interactive elements
- Screen reader friendly descriptions
- Keyboard navigation support
- Focus indicators

### Keyboard Support
- Tab navigation through all interactive elements
- Enter/Space activation for buttons
- Escape key to close modals
- Arrow key navigation where appropriate

## Performance Optimizations

### Component Optimization
- React.memo for expensive components
- useCallback for event handlers
- useMemo for computed values
- Lazy loading for non-critical components

### Bundle Optimization
- Tree shaking for unused code
- Code splitting by route
- Image optimization with Next.js Image component
- CSS purging in production

## Browser Support

### Modern Browsers
- Chrome 90+ (full support)
- Firefox 88+ (full support)
- Safari 14+ (full support)
- Edge 90+ (full support)

### Progressive Enhancement
- Graceful degradation for older browsers
- Fallbacks for CSS Grid (Flexbox)
- Polyfills where necessary
- Feature detection for advanced APIs

## Development Guidelines

### Component Structure
```
ComponentName/
├── index.tsx          # Main component
├── types.ts          # TypeScript interfaces
├── styles.module.css # Component-specific styles (if needed)
└── README.md         # Component documentation
```

### Best Practices
1. **TypeScript**: Strict type checking for all props
2. **Props**: Destructure with defaults in function signature
3. **Events**: Use proper event types (React.ChangeEvent, etc.)
4. **State**: Minimize state, use derived values
5. **Effects**: Cleanup event listeners and subscriptions
6. **Testing**: Write tests for complex components
7. **Documentation**: Comment non-obvious logic

### Code Style
- Use functional components with hooks
- Prefer composition over inheritance  
- Extract custom hooks for reusable logic
- Use Prettier for code formatting
- Follow ESLint rules for consistency