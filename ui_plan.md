```markdown
# Landing Page – UI/UX Specification

## 1. Overall Concept

**Theme**: Futuristic AI, friendly human connection, modern immersive dark design with Hinglish vibrancy.  
**Tone**: Warm, inviting, cutting-edge yet approachable.  
**Key Visual Motif**: A subtly animated 3D avatar head that watches the cursor and occasionally blinks, surrounded by a soft glow and floating Hinglish text particles.  
**Primary Call to Action**: One unmissable **“Start Talking”** button.

No login, no navigation clutter. The entire page is a single vertical scroll with one exit point – the playground.

---

## 2. Layout & Section Sequence

```
┌────────────────────────────────────────────┐
│           1. Floating Navbar                 │
├────────────────────────────────────────────┤
│           2. Hero Section                    │
│     (Avatar + main headline + CTA)           │
├────────────────────────────────────────────┤
│         3. How It Works (3 steps)            │
├────────────────────────────────────────────┤
│        4. Features Grid (highlights)         │
├────────────────────────────────────────────┤
│              5. Final CTA                    │
├────────────────────────────────────────────┤
│              6. Footer                       │
└────────────────────────────────────────────┘
```

---

## 3. Visual Language

### Colors
- **Background**: Deep space gradient `#0B0C10` (top) → `#1F2833` (bottom).
- **Primary Accent**: Vibrant Hinglish magenta `#FF007F` (buttons, glows).
- **Secondary Accent**: Electric cyan `#00E5FF` (highlights, links, particle accents).
- **Text**: `#FFFFFF` for headings, `#B0B0B0` for body.
- **Glass panels**: `rgba(255,255,255,0.03)` with `backdrop-filter: blur(12px)` and thin `rgba(255,255,255,0.08)` borders.

### Typography
- **Headings**: `'Space Grotesk', sans-serif` – modern, geometric, slightly playful.
- **Body**: `'Inter', sans-serif` – clean, readable.
- Both loaded from Google Fonts.

### Spacing & Responsive
- Max content width: `1200px`, centered.
- Sections have generous padding: `120px 24px` on desktop.
- Grids break into single column below `768px`.

---

## 4. Section-by-Section Specification

### 4.1 Floating Navbar

- **Position**: Fixed at top, z-index 100.
- **Background**: Transparent by default; after scroll > 50px, adds `rgba(10,10,15,0.8)` with `backdrop-filter: blur(20px)`.
- **Content**: Left – brand logo (text only: “Hinglish AI Avatar” in magenta gradient). Right – empty (no menu items). Only a small language toggle icon (optional, placeholder).
- **Logo style**: Gradient text from `#FF007F` to `#00E5FF`, font `Space Grotesk` bold, letter-spacing `-0.5px`.
- **Animation**: Navbar slides down on page load with a subtle fade.

### 4.2 Hero Section

- **Height**: `100vh` minimum, content centered vertically.
- **Layout**: Two columns (left text, right avatar) on desktop; stacked on mobile.

#### Left Column (Text)
- **Tagline**: Small pill badge “⚡ Powered by GenAI” – background `rgba(255,0,127,0.1)`, text magenta, rounded edges.
- **Main Headline**: 
  - “बात करो, जादू देखो”  
  - Below in smaller font: “The Hinglish AI Avatar that speaks your language.”
- **Subheadline**: “Hold natural, voice-first conversations with a lifelike 3D character. No typing, no menus – just talk.”
- **CTA Button**: 
  - Text: “Start Talking – It’s Free”  
  - Style: Full magenta gradient, rounded (`border-radius: 50px`), large padding (`18px 48px`), font weight bold.  
  - Hover: Scale up 1.05, shadow `0 0 30px rgba(255,0,127,0.6)`.  
  - Click: Links to `playground.html`.

#### Right Column (Avatar)
- **Container**: A circular glassmorphic frame (diameter ~400px) that perma-rotates a 3D avatar head (just the head model, not the full body).
- **Avatar state**:
  - Loads the same `avatar.glb` but only renders the head. The head slowly rotates 360° on a vertical axis (CSS `rotateY(0deg to 360deg)` over 20 seconds, infinite linear).
  - Eyes track the mouse cursor using a Three.js raycaster (simple head follow).
  - Every 3–5 seconds the avatar blinks (a subtle white flash over the eyes).
- **Background effect**: Behind the avatar, soft glowing orbs (cyan and magenta) pulsing with `@keyframes breathe`, blurred to create depth.
- **Particles**: Floating Roman-script Hinglish words (like “namaste”, “kaise ho”, “accha”) appear and fade out with `mix-blend-mode: screen` using CSS particles or a lightweight canvas.

**Mobile**: The avatar frame shrinks to 250px, sits above the text.

---

### 4.3 How It Works (3 Steps)

- **Section Title**: “तेरा AI dost तीन steps में” (in large magenta gradient), sub: “Get started in under 60 seconds.”
- **Steps Layout**: Three horizontal cards on desktop; vertical stack on mobile.

Each card:
- **Icon**: Animated outline icon (e.g., SVG/CSS animation) – a microphone, a brain chip, a face.
- **Step number**: “01” in cyan, large and semi-transparent behind the title.
- **Title**: Step name, e.g., “1. Speak Freely”, “2. AI Understands”, “3. Avatar Responds”.
- **Description**: One-liner in body text.
- **Animation**: On scroll, cards slide up with stagger (`IntersectionObserver`).

---

### 4.4 Features Grid

- **Section Title**: “Why हमारा Avatar?”
- **Grid**: 2x2 or 3x2 responsive grid of feature cards.

Example features:
- “Hinglish at Heart” – नेचुरल बोली, बिलकुल आपकी तरह।
- “Real-Time Voice” – no awkward pauses, sub‑second latency.
- “Customizable Looks” – swap avatars, clothes, environments.
- “Privacy First” – your voice is processed in-session, nothing stored.
- “Works Everywhere” – desktop, mobile, tablet – all you need is a mic.

Each card is a glass panel with hover: lift (translateY -4px), shadow intensify, and a thin magenta border appears.

Cards have an icon (emoji or SVG) and a short description. No lengthy text.

---

### 4.5 Final CTA

- **Background**: Full-width diagonal gradient slash (magenta to cyan at 45deg).
- **Content**: Centered, huge headline: “Ready to chat with the future?” with subtext “No sign‑up, no credit card. Just बोलो.”
- **Button**: Same style as hero, but with white background and magenta text (inverted). Hover: bright glow.

---

### 4.6 Footer

- Minimal, dark, thin line.
- Text: “Made with ❤️ for Hinglish speakers. © 2025”
- Links: “Privacy”, “Terms” (placeholders) – subtle, no underline, hover turns magenta.
- No navigation sitemap.

---

## 5. Micro‑interactions & Animations

| Element | Effect |
|--------|--------|
| Page load | Hero text fades up, avatar scales from 0.8 to 1 over 0.6s. |
| CTA button | Continuous subtle pulse (`box-shadow` glow oscillating every 2s) until clicked. |
| Scroll | Sections fade in with translateY offset as they enter viewport (threshold 0.2). |
| Avatar eye tracking | Real‑time mouse following (if the user moves cursor over the hero area). |
| Hinglish particles | Random words drift upward, fade out, regenerate over 8s cycles. |
| Card hover | Transform: translateY(-6px); transition: all 0.3s ease; box-shadow grows. |
| Navbar background | Smooth blur transition on scroll. |

---

## 6. Responsive Breakpoints

- **Desktop**: >1024px – two‑column hero, 3‑column steps, 3‑column features.
- **Tablet**: 768–1024px – hero columns stack, avatar size reduces, steps become 2‑column then 1, features 2‑column.
- **Mobile**: <768px – full single column, headline font size reduces (32px → 24px), avatar frame smaller, CTA button full width.

The design is mobile‑first in implementation, but the spec assumes desktop first for describing richness.

---

## 7. Copy & Microcopy

All Hindi/English text must use **Roman script for Hindi** (Hinglish) to match the product. English is used for universal understanding.

- Main headline: “Baat Karo, Jaadu Dekho” (with English sub)
- Tagline badge: “⚡ GenAI powered Hinglish conversations”
- CTA: “Start Talking – Free & Instant”
- How It Works step 1: “Speak in Hinglish naturally”
- Step 2: “AI samjhega aapki baat”
- Step 3: “Avatar jawab dega, jaise koi dost”
- Features title: “Kyun hamara avatar?”
- Feature 1: “Hinglish Dil Se” – Pure natural Hinglish, no Devanagari.
- Footer: “Made with ❤️ for the Hinglish internet”

---

## 8. Development Handover Notes

1. **3D Avatar**: We will reuse the TalkingHead library for the landing hero, but stripped to just a head. The developer can instantiate a minimal Three.js scene with the glb model, using a transparent background. The head rotation and eye tracking require a small custom script. Alternatively, a simple CSS animation can rotate a pre‑rendered sprite if 3D is too heavy; but for maximum “wow”, use the actual 3D model with low-poly or level-of-detail.

2. **Performance**: Lazy‑load Three.js and the avatar model only when the hero section is visible. Use `IntersectionObserver` to start the 3D scene after page load to avoid blocking.

3. **Accessibility**: All clickable elements have `aria-label`, the CTA is a link styled as a button, and focus states are clearly indicated (magenta outline).

4. **No Build Step**: Vanilla HTML/CSS/JS, no frameworks. The landing page is a separate static file.

5. **Browser Support**: Modern evergreen browsers (Chrome, Edge, Safari, Firefox). Graceful degradation: if WebGL is not supported, show a static avatar image.

---

This document gives your front‑end developer a pixel‑perfect blueprint. They can start coding immediately.
```