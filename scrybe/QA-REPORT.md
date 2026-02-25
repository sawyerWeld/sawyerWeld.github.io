# Scrybe QA Report

**Date:** 2025-02-25  
**Tester:** Automated QA Agent  
**URL:** https://sawyerwelden.com/scrybe/  
**API:** https://scrybe-api.fly.dev/health → `{"ok": true}` ✅

---

## 1. Page Load

### Desktop (1920×1080) ✅
- Page loads cleanly with dark theme
- Tutorial overlay appears on first visit as expected
- All UI elements render correctly

### Mobile (390×844) ✅
- Layout adapts well to mobile viewport
- Top bar, empty state, record button, and status dots all visible
- No horizontal overflow or clipping detected

---

## 2. Tutorial Overlay ✅

- **First visit:** Overlay appears automatically with mic emoji, title, and three sections (How it works, Card recognition, Privacy)
- **Content:** Well-written, covers usage, set seeding (Lorwyn Eclipsed + LE Commander), and privacy policy
- **"Got it" button:** Prominent amber/gold button, dismisses overlay correctly
- **? button:** Successfully re-opens tutorial after dismissal
- **Layout:** Centered modal, good contrast, readable text on dark background

---

## 3. WebSocket Connection ✅

- Two green status dots visible flanking the record button in the bottom controls area
- No WebSocket errors in browser console
- Indicates successful connection to the backend

---

## 4. UI Elements ✅

| Element | Status | Notes |
|---------|--------|-------|
| Top bar (stats) | ✅ | Shows "0 cards" and "$0.00" in amber/gold |
| ? button | ✅ | Centered in top bar, circular outline |
| Hamburger menu (☰) | ✅ | Top-right corner |
| Accepted cards strip | ✅ | "Accepted cards appear here" placeholder text |
| Empty state | ✅ | Mic emoji + "Tap record and start reading card names" |
| Record button | ✅ | Large red/white circular button, centered at bottom |
| Status dots | ✅ | Green dots on either side of record button |

---

## 5. Hamburger Menu ✅

Slide-out panel from right with:
- **EXPORT** header
- Archidekt, CSV, MTGO / Arena, JSON export options
- **Reset Session** (separated from exports)
- **"Made by Sawyer Welden"** attribution link at bottom

All items present and properly spaced.

---

## 6. Responsive Design ✅

- Desktop: Generous spacing, centered content, appropriately sized controls
- Mobile: Compact but functional, all elements accessible, no overflow
- Both viewports show consistent visual language (dark theme, amber accents)

---

## 7. API Connectivity ✅

- Health endpoint returns `{"ok": true}` (78ms response)
- Zero console errors on both desktop and mobile loads
- WebSocket status indicators show green (connected)

---

## 8. Visual Polish

### Overall: Very clean ✅

No clipping, overflow, or misalignment issues detected.

---

## Bugs Found

**None critical, major, or minor.**

### Cosmetic

1. **Modifier area not visible in empty state** — The modifier pills (foil, showcase, etc.) aren't shown until a card is recognized. This is likely intentional but could be confusing for first-time users wondering where they are.

---

## Suggestions

1. **Tutorial content update** — The tutorial mentions "Lorwyn Eclipsed" and "LE Commander" as seeded sets. Consider making this dynamic or updating when sets change.
2. **Keyboard shortcut hints** — For desktop users, showing that spacebar or a key triggers recording could improve UX.
3. **Empty export feedback** — Clicking export with 0 cards could show a toast/message rather than silently doing nothing (not tested, but worth checking).

---

## Overall Assessment

**PASS** ✅

Scrybe is polished and functional. The dark theme with amber accents looks professional. Tutorial is well-written and informative. Responsive layout works well across desktop and mobile viewports. API backend is healthy and WebSocket connections establish without errors. No bugs found during visual QA.

The app is ready for user testing with actual microphone input.
