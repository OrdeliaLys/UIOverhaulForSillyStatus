# UI Overhaul for SillyStatus

A SillyTavern extension that restyles the **character list**, the **persona list** and the **chat** with a choice of design philosophies, and adds a **Like** button with a per-card **Like Tracker**. Built for phones, and made to sit nicely alongside SillyStatus, Scene Backdrop (FunTimeDisplay) and Silly Optimizer.

## Install

In SillyTavern: **Extensions** (cubes icon) → **Install extension** → paste:

```
https://github.com/OrdeliaLys/UIOverhaulForSillyStatus
```

Then reload the page. Settings are under **Extensions → UI Overhaul**.

## Stage mode (complete overhaul)

Tick **Complete overhaul (Stage mode)** at the top of the settings to swap SillyTavern's interface for a different app built on top of it. SillyTavern still does all the work underneath; only the way you get around changes.

- **Home**: a portrait-first screen for your cast. *Continue* your current or latest story, recent chats and your most-liked cards in rows, then everyone (groups too) in a grid you can search, sort (Recent, Most liked, Favourites, A–Z, Newest) and filter by tag. Tap your persona at the top to switch who you play; **+** makes, imports or groups characters.
- **Profiles**: tapping a character on Home (or the name in the chat bar) opens their profile. The first time, the AI writes a short pitch and four story ideas, each with where it could lead. Each idea has a few tags, and the card gets 3–6 tags that are added to the character in SillyTavern (reusing your existing tags; the ones it added can be removed with ×). They're saved per card; **Retry** writes new ones, and **Play this** has the AI write a custom opening message for that idea, adds it to the card's alternate greetings (outlined and labelled *AI-written opening* in chat), and starts a new chat on it. Saved openings are reused; ↻ writes a new one in its place.
- **Chat**: full screen with a slim bar showing who you're with, their status effects as rings that fill with each stage (tap for the SillyStatus panel) and a like button. Dialogue reads bright and narration recedes. Above the message box: **Reroll**, **Swipe**, **Continue**, **Write mine**, **OOC** (starts an out-of-character note) and **Text** (starts a `**@you:**` text message). **⋮** holds new chat, history, the character card, author's note, delete and close.
- **Cast board** (⋮ → Cast board): everyone met in the chat who isn't a card yet — characters invented through OOC (with their intro card) and named speakers who keep coming back. **Make a card** has the AI write a full character card for them from the chat, with tags.
- **Adapt to your persona**: a fresh chat's human-written greeting gets an *Adapt to (persona)* button. The AI rewrites it to fit your persona (pronouns, looks, how characters treat you) as an extra swipe in that chat only; the card is never changed. Works outside Stage too.
- **Like insights**: the tags your likes lean towards, and unliked cards that share them, in the Like Tracker and as *You might like* on Home.
- **Backstage** (the gear): every SillyTavern menu as a labelled tile. Each opens full screen with a **Back** button.
- The phone's back button steps back through all of this instead of leaving the page.

Leave it with **Leave Stage mode** at the bottom of Backstage, or untick it under Extensions → UI Overhaul.

## Designs

Pick a preset to style everything at once, or set each area on its own:

| | Character & persona lists | Chat |
|---|---|---|
| **Gallery** (visual-first) | Portrait tiles in a grid, name and two lines over the art, like count in the corner | Soft cards with roomy avatars |
| **Reader** (text-first) | Compact rows, small avatars, three-line descriptions, tags as #hashtags | No boxes, a centred reading column, small-caps names, relaxed line spacing |
| **Messenger** (chat-app) | Contact-list rows with round avatars and one-line previews | Speech bubbles, your messages on the right in the accent colour |

Any area can also be set to **SillyTavern default**. The **Accent colour** tints highlights, names, your bubbles and liked buttons.

**Matching chrome** (on by default) gives everything around the chat one rounded look, with the accent marking whatever is active: the top bar tabs, every menu they open (buttons, fields, checkboxes, sliders and section headers), the character panel's header, the send bar with its ☰ and ✨ menus, SillyStatus's status button and Silly Optimizer's FPS meter.

**Sharp portraits** (on by default) swaps SillyTavern's small thumbnails for the full-size images as portraits scroll into view, in the lists and in chat. Turn it off if a very large library loads slowly.

## Like and the Like Tracker

A **Like** button appears on every character in the list and on character messages in chat. Each tap adds one like, so a card can be liked as many times as you want. The button's text and icon can be renamed in settings, and either location can be turned off.

Every change shows a small bar with **Undo** for a few seconds (quick repeated taps on one card undo together). The **Like Tracker** in settings lists every liked card by count, with **+**, **−** and a reset button per card, plus **Undo** and **Reset all** (asks first, and can be undone). The character list's sort menu gains **♥ Most liked**.

## Plays nicely with other extensions

- It only adds styles and small buttons; SillyTavern's own elements are never moved.
- Message backgrounds stay see-through, so the scene backdrop and SillyStatus screen effects show behind them.
- SillyStatus portrait badges and change chips keep their place in every style (in Bubbles, badges on your right-hand avatar move to its inner side).
- No transforms on messages, so SillyStatus's woozy sway and Silly Optimizer's off-screen skipping keep working.

For other extension authors: likes are available as `globalThis.UIOverhaul.getLikes(avatarFile?)` `UIOverhaul.like(avatarFile, by)`, `UIOverhaul.reset(avatarFile?)` and `UIOverhaul.undo()`, and a `uio:likes` event fires on `document` when a count changes. The active styles are body classes (`uio-chars-*`, `uio-personas-*`, `uio-chat-*`).
