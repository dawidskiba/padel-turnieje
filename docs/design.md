# Design

Visual language, derived from the Garden Padel logo. Screen-by-screen layout is in
[`screens.md`](./screens.md).

## The logo

`src/GLOWNE_PION_SZMARAGD_TLO.png` — a vertical lockup: a sage circle with a white stem
(a tree), `GARDEN` in a wide geometric sans, `PADEL` letterspaced beneath, all on a deep
emerald ground.

Three colours, and only three:

| Role | Hex | Share of the image |
|---|---|---|
| Emerald ground | `#003333` | 97.7% |
| White | `#FFFFFF` | 1.7% |
| Sage | `#94B487` | 0.49% |

## The constraint that shaped everything

Sage is a mid-lightness, low-saturation green. Measured against each possible ground:

| Pair | Ratio | |
|---|---|---|
| Emerald text on white | 13.80:1 | AAA |
| White text on emerald | 13.80:1 | AAA |
| Sage on emerald | 6.01:1 | AA |
| **Sage on white** | **2.30:1** | **fails** |

The brand's only accent colour is unusable as text, icons or thin strokes on a light
background. It works *only* on the dark ground it was designed for.

Since the app has a light/dark toggle, the light theme cannot simply reuse sage. It uses
a darker step of the same hue instead — `#4C6B40`, still recognisably the brand green,
but at a lightness that passes on white. Sage itself survives in light mode only as a
large decorative fill, never as text.

## Tokens

Defined as CSS custom properties in [`src/index.css`](../src/index.css) and exposed as
Tailwind colours in [`tailwind.config.js`](../tailwind.config.js), so one set of utility
classes serves both themes. Every pair below is verified at WCAG AA or better.

### Dark — the brand's native ground

| Token | Hex | Contrast |
|---|---|---|
| `bg` | `#003333` | the logo ground |
| `surface` | `#0B3F3F` | court cards |
| `surface-raised` | `#155050` | popups, sheets |
| `border` | `#256060` | 1.92:1 on bg |
| `text` | `#FFFFFF` | 13.80:1 |
| `text-muted` | `#A9C4C4` | 7.48:1 |
| `accent` | `#94B487` | 6.01:1 — the brand sage |
| `on-accent` | `#002424` | 7.15:1 on accent |
| `warning` | `#E8B96B` | 7.61:1 |
| `danger` | `#F49183` | 6.06:1 |

### Light

| Token | Hex | Contrast |
|---|---|---|
| `bg` | `#FFFFFF` | |
| `surface` | `#F2F7F5` | |
| `surface-raised` | `#E6EFEC` | |
| `border` | `#CBDBD6` | 1.43:1 on bg |
| `text` | `#062B2B` | 15.13:1 |
| `text-muted` | `#4A6B6B` | 5.82:1 |
| `accent` | `#4C6B40` | 6.03:1 — sage darkened to pass |
| `on-accent` | `#FFFFFF` | 6.03:1 on accent |
| `warning` | `#7A5200` | 6.92:1 |
| `danger` | `#A3231A` | 7.47:1 |

`brand-sage` (`#94B487`) stays available in both themes for decorative fills — the
podium, the QR screen, the empty-state tree. Text on it must be `on-brand-sage`
(`#003333`, 6.01:1).

### Theme resolution

Three states, in the order the CSS resolves them:

1. Bare `:root` defines the complete light palette — the default.
2. `@media (prefers-color-scheme: dark)` combined with `:root:not([data-theme="light"])`
   redefines the tokens for users whose system is dark and who have not chosen light.
3. `:root[data-theme="dark"]` redefines them again, so an explicit toggle wins in both
   directions.

The media query wraps the selector rather than nesting inside it. Nested at-rules are
flattened by the build and the guard is silently lost, which hands the dark palette to
light-mode users — verified in the emitted CSS, not assumed.

## How the accent is used

Sage (dark) / darkened sage (light) marks anything **actionable or complete**:

- confirm and primary buttons — accent fill, `on-accent` text
- the tick on a court whose score is in
- the active segment of `[Tabela] [Rundy]`
- the leader's row in the standings

Warning and danger have their own hues, so the accent never has to carry two
contradictory meanings at once.

## Typography

The wordmark is a wide geometric sans with generous letterspacing. The interface should
not imitate it — a wordmark and a scoreboard have opposite jobs. Scores are read at a
glance from a metre away across a desk, so the UI wants a neutral, high-legibility face
with tabular figures, letting the logo carry the personality.

Tabular figures matter specifically: scores and points sit in columns that must not
shuffle as digits change.

## Assets still needed

The supplied file is a 6000px PNG with the background baked in. For the app:

- a horizontal lockup with a transparent background, for the header
- the mark alone (circle and stem), for the favicon and small spaces
- SVG for all of them, if the designer has it

Until they arrive, the header can crop this file — harmless on the dark theme, wrong on
the light one.
