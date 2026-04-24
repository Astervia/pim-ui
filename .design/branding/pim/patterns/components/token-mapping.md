# Token Mapping: PIM → shadcn/ui + Tailwind v4

> How PIM tokens from `pim.yml` map into the Next.js 15 + Tailwind v4 + shadcn/ui stack.

---

## globals.css (Tailwind v4 `@theme`)

```css
@import "tailwindcss";

@theme {
  --font-mono: 'Geist Mono', ui-monospace, 'Cascadia Code', monospace;
  --font-sans: 'Geist', system-ui, sans-serif;
  --font-code: 'JetBrains Mono', 'Fira Code', monospace;

  --color-background: #0a0c0a;
  --color-foreground: #d4d8d4;
  --color-card: #121513;
  --color-card-foreground: #d4d8d4;
  --color-popover: #1a1e1b;
  --color-popover-foreground: #d4d8d4;
  --color-primary: #22c55e;
  --color-primary-foreground: #0a0c0a;
  --color-secondary: #1a1e1b;
  --color-secondary-foreground: #d4d8d4;
  --color-accent: #e8a84a;
  --color-accent-foreground: #0a0c0a;
  --color-muted: #2a2e2c;
  --color-muted-foreground: #7a807c;
  --color-destructive: #ff5555;
  --color-destructive-foreground: #ffffff;
  --color-border: #2a2e2c;
  --color-input: #2a2e2c;
  --color-ring: #22c55e;

  --radius: 0;
  --radius-sm: 0;
  --radius-md: 0;
  --radius-lg: 0;
}

/* CRT scanline overlay — fixed on body */
body::before {
  content: '';
  position: fixed; inset: 0;
  pointer-events: none; z-index: 9999;
  background: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px);
  mix-blend-mode: overlay;
}

/* Phosphor glow for signal-green text */
.phosphor { text-shadow: 0 0 4px rgba(34,197,94,0.4), 0 0 8px rgba(34,197,94,0.2); }

/* Cursor blink */
@keyframes blink { 50% { opacity: 0; } }
.cursor-blink { animation: blink 1s step-end infinite; }
```

---

## Font loading (Next.js)

```tsx
// app/layout.tsx
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { JetBrains_Mono } from 'next/font/google'

const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-code' })

export default function RootLayout({ children }) {
  return (
    <html className={`${GeistMono.variable} ${GeistSans.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

---

## shadcn/ui component overrides

PIM inherits shadcn/ui defaults but overrides the following:

### Button

```tsx
// components/ui/button.tsx — buttonVariants
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-none font-mono font-medium uppercase tracking-wide transition-colors duration-100 ease-linear focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border border-primary hover:bg-background hover:text-primary",
        secondary: "bg-transparent text-foreground border border-border hover:border-primary hover:text-primary",
        destructive: "bg-destructive text-white border border-destructive",
        ghost: "hover:bg-muted hover:text-foreground",
      },
      size: {
        default: "h-10 px-5 py-2 text-sm",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)
```

**Usage pattern:** Wrap button label in `[ ... ]` brackets manually or via helper:
```tsx
<Button>[ READ THE PROTOCOL ]</Button>
```

### Card

```tsx
// components/ui/card.tsx
<div className="bg-card border border-border rounded-none shadow-none">
  <div className="px-6 py-4 border-b border-border font-mono text-xs uppercase tracking-widest text-muted-foreground">
    ┌─── TITLE ───┐
  </div>
  <div className="p-6">{children}</div>
</div>
```

Override: remove all `rounded-*` and `shadow-*` classes. Headers use ASCII-style decoration.

### Input

```tsx
// components/ui/input.tsx
<div className="flex items-center font-code text-sm">
  <span className="text-primary mr-2">&gt;</span>
  <input
    className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground caret-primary"
    {...props}
  />
</div>
```

Override: no box, no border, no ring. Prompt-style `>` prefix, block caret.

### Badge

```tsx
// components/ui/badge.tsx
const badgeVariants = cva(
  "inline-flex items-center rounded-none border font-mono text-[11px] uppercase tracking-wider px-2 py-0.5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-primary",
        warning: "bg-accent text-accent-foreground border-accent",
        destructive: "bg-destructive text-white border-destructive",
        outline: "bg-transparent text-muted-foreground border-border",
      },
    },
    defaultVariants: { variant: "default" },
  }
)
```

**Usage pattern:** Label in brackets: `<Badge>[OK]</Badge>`, `<Badge variant="warning">[WARN]</Badge>`.

---

## Custom components (no shadcn equivalent)

### CliPanel

```tsx
// components/brand/cli-panel.tsx
export function CliPanel({ title, status, children }: {
  title: string
  status?: 'ok' | 'warn' | 'err'
  children: React.ReactNode
}) {
  return (
    <div className="bg-popover border border-border font-code text-sm text-foreground">
      <div className="px-4 py-2 border-b border-border flex justify-between items-center text-xs text-muted-foreground">
        <span>┌─── {title.toUpperCase()} ───┐</span>
        {status && <Badge variant={statusVariant(status)}>[{status.toUpperCase()}]</Badge>}
      </div>
      <pre className="px-4 py-3 leading-[1.7] overflow-x-auto">{children}</pre>
    </div>
  )
}
```

### StatusIndicator

```tsx
// components/brand/status.tsx
const indicators = {
  active:     { char: '◆', color: 'text-primary phosphor' },
  relayed:    { char: '◈', color: 'text-accent' },
  connecting: { char: '○', color: 'text-muted-foreground' },
  failed:     { char: '✗', color: 'text-destructive' },
} as const

export function StatusIndicator({ state }: { state: keyof typeof indicators }) {
  const { char, color } = indicators[state]
  return <span className={`font-mono ${color}`}>{char}</span>
}
```

### Logo

```tsx
// components/brand/logo.tsx
export function Logo({ size = 'default', animated = false }: {
  size?: 'sm' | 'default' | 'lg' | 'hero'
  animated?: boolean
}) {
  const sizes = {
    sm: 'text-lg',
    default: 'text-2xl',
    lg: 'text-4xl',
    hero: 'text-5xl md:text-6xl',
  }

  if (animated) {
    return (
      <span className={`logo-hero font-mono font-semibold inline-flex items-baseline gap-[0.5ch] ${sizes[size]}`}>
        <span className="logo-block text-primary phosphor">█</span>
        <span className="logo-typed inline-block overflow-hidden whitespace-nowrap text-foreground">pim</span>
      </span>
    )
  }

  return (
    <span className={`font-mono font-semibold ${sizes[size]}`}>
      <span className="text-primary phosphor">█</span>
      <span className="text-foreground ml-[0.4em] tracking-tight">pim</span>
    </span>
  )
}
```

Add to `globals.css`:

```css
/* Animated hero logo — block cursor blinks, "pim" types out */
.logo-hero .logo-block { animation: blink 1.1s step-end infinite; }
.logo-hero .logo-typed {
  width: 0;
  animation: type-pim 0.9s steps(3, end) 0.5s forwards;
}

@keyframes blink    { 50% { opacity: 0; } }
@keyframes type-pim { to  { width: 3ch; } }

/* Respect user preference */
@media (prefers-reduced-motion: reduce) {
  .logo-hero .logo-block  { animation: none; }
  .logo-hero .logo-typed  { width: 3ch; animation: none; }
}
```

**Usage:**
- `<Logo animated size="hero" />` — hero / landing page / docs header
- `<Logo size="sm" />` — nav, sticky header, footer (static)
- `<Logo size="default" />` — inline references, breadcrumbs

Keep nav/sticky contexts static — the blinking cursor is only appropriate at hero scale.

---

## Don'ts (enforceable via lint / code review)

- No `rounded-*` classes anywhere (except `rounded-none`)
- No `shadow-*` classes (except custom `.phosphor` on signal-green text)
- No `bg-gradient-*` classes — flat dark layers only
- No Lucide filled icons — stroke-only at `strokeWidth={2}`, or Unicode
- No `text-white` on non-destructive surfaces — use `text-foreground`
- No `!` in UI copy strings
- No non-mono `font-*` classes on buttons, labels, nav, headings

---

## Install

```bash
npx shadcn@latest init
# When prompted: style → new-york, base color → neutral, css variables → yes
npm install geist @fontsource/jetbrains-mono
```

Then:
1. Copy `globals.css` content above into `app/globals.css`
2. Replace shadcn `button.tsx`, `card.tsx`, `input.tsx`, `badge.tsx` with PIM overrides
3. Add `components/brand/` custom components
4. Done — start building.
