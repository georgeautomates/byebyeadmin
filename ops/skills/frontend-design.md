---
name: frontend-design
category: product
depends-on: []
outputs: [react-component, next-js-page, ui-layout]
triggers: [component, UI, frontend, React, Next.js, page, design, layout]
overlaps: [assessment-builder (builds UI for assessments)]
pre-flight: Check ops/learnings.md → frontend-design section before starting.
---

# Skill: Frontend Design

## Purpose

Design and build React/Next.js UI components for ByeByeAdmin and client sites. Follows the existing design system and conventions strictly.

## Design system (byebyeadmin)

```ts
// lib/constants.ts
C.accent    = '#E8612D'  // orange
C.teal      = '#2D8B8B'
C.bg        = '#F5F2EF'  // warm off-white
C.bgWhite   = '#FFFFFF'
C.bgDark    = '#1F2937'
C.dark      = '#1F2937'
C.text      = '#374151'
C.textLight = '#6B7280'

FONT = "'Nunito Sans', sans-serif"
MONO = "'JetBrains Mono', monospace"
```

Always import from `lib/constants.ts`. Never hardcode hex values.

## Conventions

- **Inline styles only** — no Tailwind classes, no CSS modules
- **No em dashes** in any rendered text
- React functional components with TypeScript
- `'use client'` directive on any component with hooks or browser APIs
- Shared UI primitives in `components/ui/index.tsx` — use `Fade`, `Btn`, `Section`, `Card` etc. before creating new ones

## Layout patterns

### Section with constrained content column
```tsx
<div style={{ background: C.bg, padding: '80px 24px' }}>
  <div style={{ maxWidth: 680, margin: '0 auto' }}>
    {/* content */}
  </div>
</div>
```

### Full-width dark banner + constrained content
```tsx
<div style={{ background: C.bgDark, padding: '64px 24px' }}>
  {/* full width */}
</div>
<div style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px' }}>
  {/* constrained */}
</div>
```

## Animation

- GSAP ScrollTrigger for scroll-driven animations
- Framer Motion for component-level transitions
- Lenis for smooth scrolling (via `LenisProvider`)
- Three.js for 3D (ThreeHero only — don't add new Three scenes without good reason)

## Responsive design

- Mobile breakpoint: 768px
- Use `isMobile` state from `window.innerWidth < 768` in components that need it
- Test layouts at 375px (iPhone SE) and 390px (iPhone 14)

## Before building a new component

Check `components/ui/index.tsx` for existing primitives. Check the relevant page file for patterns already in use. Avoid duplicating logic.
