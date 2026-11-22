# UI Overhaul for SillyStatus

A SillyTavern extension that restyles the **character list**, the **persona list** and the **chat** with a choice of design philosophies, and adds a **Like** button with a per-card **Like Tracker**. Built for phones, and made to sit nicely alongside SillyStatus, Scene Backdrop (FunTimeDisplay) and Silly Optimizer.

## Install

In SillyTavern: **Extensions** (cubes icon) → **Install extension** → paste:

```
https://github.com/OrdeliaLys/UIOverhaulForSillyStatus
```

Then reload the page. Settings are under **Extensions → UI Overhaul**.

## Designs

Pick a preset to style everything at once, or set each area on its own:

| | Character & persona lists | Chat |
|---|---|---|
| **Gallery** (visual-first) | Portrait tiles in a grid, name and two lines over the art, like count in the corner | Soft cards with roomy avatars |
| **Reader** (text-first) | Compact rows, small avatars, three-line descriptions, tags as #hashtags | No boxes, a centred reading column, small-caps names, relaxed line spacing |
| **Messenger** (chat-app) | Contact-list rows with round avatars and one-line previews | Speech bubbles, your messages on the right in the accent colour |

Any area can also be set to **SillyTavern default**. The **Accent colour** tints highlights, names, your bubbles and liked buttons.

**Matching chrome** (on by default) gives the top bar tabs, the character panel's header (buttons, sort menu, search, filter row, pagination), SillyStatus's status button and Silly Optimizer's FPS meter the same rounded look, with the accent marking whatever is active.

**Sharp portraits** (on by default) swaps SillyTavern's small thumbnails for the full-size images as portraits scroll into view, in the lists and in chat. Turn it off if a very large library loads slowly.

## Like and the Like Tracker

A **Like** button appears on every character in the list and on character messages in chat. Each tap adds one like, so a card can be liked as many times as you want. The button's text and icon can be renamed in settings, and either location can be turned off.

The **Like Tracker** in settings lists every liked card by count, with **+** and **−** to adjust. The character list's sort menu gains **♥ Most liked**.

## Plays nicely with other extensions

- It only adds styles and small buttons; SillyTavern's own elements are never moved.
- Message backgrounds stay see-through, so the scene backdrop and SillyStatus screen effects show behind them.
- SillyStatus portrait badges and change chips keep their place in every style (in Bubbles, badges on your right-hand avatar move to its inner side).
- No transforms on messages, so SillyStatus's woozy sway and Silly Optimizer's off-screen skipping keep working.

For other extension authors: likes are available as `globalThis.UIOverhaul.getLikes(avatarFile?)` and `UIOverhaul.like(avatarFile, by)`, and a `uio:likes` event fires on `document` when a count changes. The active styles are body classes (`uio-chars-*`, `uio-personas-*`, `uio-chat-*`).
