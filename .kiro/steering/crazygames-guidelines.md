---
inclusion: always
---

# CrazyGames Quality Guidelines

This game is being built for publication on CrazyGames. All future work must adhere to these guidelines. Source: CrazyGames developer documentation.

## Onboarding

- New users land directly in gameplay, no menus blocking the way.
- A short visual onboarding shows the controls (mouse/keyboard or drag/tap icons).
- The onboarding is skippable.
- Onboarding prioritizes visuals over text.
- UI buttons are clearly labeled and not designed to trick users into ads or clicks.

## General Principles

- Clear goals — the player always knows what they are trying to achieve.
- Easy to learn within seconds.
- Language must be clear and well written. Default to English for international reach. Auto-detect with `navigator.language` and fall back to English for unsupported locales.
- Controls are consistent and intuitive.

## Fun Experience

- Game responds quickly — keep input latency near zero, target 60 FPS.
- Visual layout is comfortable for both desktop and mobile.
- Audio is balanced — levels consistent, not too loud, must match the visuals.
- Avoid overly repetitive or boring tasks.
- If multiplayer is offered, single-player must be equally prominent. If single-player only, say so clearly.

## Uniqueness

- Game name must be unique. "Spaghetti.io" qualifies; do not rename without strong reason.
- Genre should not change after submission.
- Plan for ongoing updates and content additions.

## Aesthetics

- Graphics are high quality and resolution stays consistent throughout.
- No compression artifacts.
- One visual style — do not mix realistic with cartoony.
- Audio quality matches visual quality.

## Restricted Keys

- Avoid Escape — closes fullscreen on CrazyGames.
- Avoid Ctrl/Cmd+W — closes the browser tab.
- Make key bindings adapt to keyboard layout where possible. AZERTY users in France have ZQSD instead of WASD; avoid hardcoding WASD as the only movement option.

## Working Conventions for This Project

- Default UI language is English. German is provided as auto-detected alternative.
- All user-facing strings go through the `t()` helper in `src/i18n.js`. Status text used only for development (e.g., progress markers) does not need translation but should not be visible in production builds.
- Mobile controls must NEVER conflate direction input with action input. Finger position = direction. Action buttons are explicit on-screen elements.
- Tutorial overlay is shown once per browser (localStorage flag). User can dismiss any time with a clearly labeled button.
- HUD must not contain developer notes in production. Use the README and commit messages to track project state instead.
