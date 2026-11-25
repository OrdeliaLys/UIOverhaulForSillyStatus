// UI Overhaul for SillyTavern
// Restyles the character list, the persona list and the chat with a choice of
// design philosophies (Gallery, Reader, Messenger), and adds a Like button with
// a per-card Like Tracker. It only adds styles and small buttons: it never
// moves SillyTavern's own elements, so other extensions keep working.

const VERSION = '2.8.0';
const MODULE = 'ui_overhaul';

import { createStage } from './stage.js';
import { ask, cut, personaInfo, BLUNT, PRONOUNS } from './ai.js';
import { createWrapped, wrappedTheme } from './wrapped.js';
import { createAccents } from './accents.js';
import { createCreator } from './creator.js';

// Stage mode's stylesheet loads only with the module, next to this file.
(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('./stage.css', import.meta.url).href;
    document.head.appendChild(link);
    const creatorCss = document.createElement('link');
    creatorCss.rel = 'stylesheet';
    creatorCss.href = new URL('./creator.css', import.meta.url).href;
    document.head.appendChild(creatorCss);
    const wrapCss = document.createElement('link');
    wrapCss.rel = 'stylesheet';
    wrapCss.href = new URL('./wrapped.css', import.meta.url).href;
    document.head.appendChild(wrapCss);
})();

const STYLES = {
    lists: [['gallery', 'Gallery (portrait tiles)'], ['reader', 'Reader (compact, text-first)'], ['messenger', 'Messenger (contact list)'], ['stock', 'SillyTavern default']],
    chat: [['cards', 'Cards (Gallery)'], ['reader', 'Reader (book-like)'], ['bubbles', 'Bubbles (Messenger)'], ['stock', 'SillyTavern default']],
};

const PRESETS = {
    gallery: { charStyle: 'gallery', personaStyle: 'gallery', chatStyle: 'cards' },
    reader: { charStyle: 'reader', personaStyle: 'reader', chatStyle: 'reader' },
    messenger: { charStyle: 'messenger', personaStyle: 'messenger', chatStyle: 'bubbles' },
};

const DEFAULTS = {
    enabled: true,
    charStyle: 'gallery',
    personaStyle: 'gallery',
    chatStyle: 'cards',
    accent: '#b56cff',
    likeLabel: 'Like',
    likeIcon: '♥',
    likesInList: true,
    likesInChat: true,
    complete: false,    // Stage mode: the complete overhaul
    accentWords: true,  // note English words characters show they don't know
    stageSort: 'recent',
    chrome: true,       // restyle the top bar, panel headers and other extensions' buttons
    sharp: true,        // load full-size portraits instead of SillyTavern's small thumbnails
    likes: {},       // avatar file -> count
    likeNames: {},   // avatar file -> last known name (for the tracker)
};

function ctx() {
    return SillyTavern.getContext();
}

function settings() {
    const store = ctx().extensionSettings;
    if (!store[MODULE] || typeof store[MODULE] !== 'object') store[MODULE] = structuredClone(DEFAULTS);
    const s = store[MODULE];
    for (const [k, v] of Object.entries(DEFAULTS)) if (s[k] === undefined) s[k] = structuredClone(v);
    return s;
}

function save() {
    ctx().saveSettingsDebounced();
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function thumb(avatar) {
    return `/thumbnail?type=avatar&file=${encodeURIComponent(avatar)}`;
}

// ---------- applying the look ----------

function apply() {
    const s = settings();
    const body = document.body;
    for (const cls of [...body.classList]) if (cls.startsWith('uio-')) body.classList.remove(cls);
    if (!s.enabled) {
        stage.disable();
        return;
    }
    const chatStyle = s.complete ? 'stage' : s.chatStyle;
    body.classList.add('uio-on', `uio-chars-${s.charStyle}`, `uio-personas-${s.personaStyle}`, `uio-chat-${chatStyle}`);
    if (s.chrome || s.complete) body.classList.add('uio-chrome');
    if (s.complete) stage.enable();
    else stage.disable();
    if (!s.likesInList) body.classList.add('uio-no-list-likes');
    if (!s.likesInChat) body.classList.add('uio-no-chat-likes');
    body.style.setProperty('--uio-accent', s.accent);
    decorateAll();
}

// ---------- sharp portraits ----------
// SillyTavern shows small thumbnails (about 96x144) in lists and chat, which
// look blurry on big tiles and high-density phone screens. When a portrait
// scrolls into view, its full-size image is offered through srcset. The src
// attribute stays the thumbnail, because SillyTavern reads it (for example to
// open the zoomed avatar), and if the full image fails the thumbnail stays.

const SHARP_SCOPE = '#rm_print_characters_block .avatar img, #user_avatar_block .avatar img, #chat .mes .avatar img, .hotswap .avatar img';

function fullImageUrl(src) {
    const m = /\/thumbnail\?type=(avatar|persona)&file=([^&]+)(?:&t=(\d+))?/.exec(src ?? '');
    if (!m) return null;
    const file = encodeURIComponent(decodeURIComponent(m[2]));
    const base = m[1] === 'avatar' ? `/characters/${file}` : `/User%20Avatars/${file}`;
    return m[3] ? `${base}?t=${m[3]}` : base;
}

function sharpen(img) {
    const src = img.getAttribute('src');
    if (img.dataset.uioSrc === src && img.hasAttribute('srcset') === !!fullImageUrl(src)) return;
    img.dataset.uioSrc = src ?? '';
    const full = settings().enabled && settings().sharp ? fullImageUrl(src) : null;
    if (!full) {
        if (img.dataset.uioSharp) { img.removeAttribute('srcset'); delete img.dataset.uioSharp; }
        return;
    }
    img.addEventListener('error', () => { img.removeAttribute('srcset'); delete img.dataset.uioSharp; }, { once: true });
    img.decoding = 'async';
    img.dataset.uioSharp = '1';
    img.srcset = full;
}

const sharpWatcher = 'IntersectionObserver' in globalThis
    ? new IntersectionObserver((entries) => {
        for (const e of entries) {
            if (!e.isIntersecting) continue;
            sharpWatcher.unobserve(e.target);
            e.target.dataset.uioSeen = '1';
            sharpen(e.target);
        }
    }, { rootMargin: '300px' })
    : null;

function sharpenAll() {
    for (const img of document.querySelectorAll(SHARP_SCOPE)) {
        if (img.dataset.uioSeen || !sharpWatcher) sharpen(img);
        else sharpWatcher.observe(img);
    }
}

// ---------- sort by likes ----------
// SillyTavern sorts the character list by a field on each character, chosen in
// the sort menu. A read-only "uio_likes" field (not saved into any card) lets a
// "Most liked" entry in that menu sort by like count.

const SORT_FIELD = 'uio_likes';
if (!Object.prototype.hasOwnProperty.call(Object.prototype, SORT_FIELD)) {
    Object.defineProperty(Object.prototype, SORT_FIELD, {
        configurable: true,
        enumerable: false,
        get() {
            const avatar = this?.avatar;
            if (typeof avatar !== 'string') return 0;
            try { return settings().enabled ? likeCount(avatar) : 0; } catch { return 0; }
        },
        set(value) {
            Object.defineProperty(this, SORT_FIELD, { value, writable: true, configurable: true, enumerable: true });
        },
    });
}

// "Most liked", following the renamed button: "Fav" → "Most favs".
function mostLabel() {
    const label = settings().likeLabel.trim() || 'Like';
    if (/^like$/i.test(label)) return 'Most liked';
    const word = label.toLowerCase();
    return `Most ${/s$/.test(word) ? word : `${word}s`}`;
}

function sortLabel() {
    return `${settings().likeIcon} ${mostLabel()}`;
}

function addSortOption() {
    const select = document.getElementById('character_sort_order');
    if (!select) return;
    let opt = select.querySelector(`option[data-field="${SORT_FIELD}"]`);
    if (!opt) {
        opt = document.createElement('option');
        opt.dataset.field = SORT_FIELD;
        opt.dataset.order = 'desc';
        const fav = select.querySelector('option[data-field="fav"]');
        fav ? fav.after(opt) : select.appendChild(opt);
        const pu = ctx().powerUserSettings;
        if (pu?.sort_field === SORT_FIELD) opt.selected = true;
    }
    opt.textContent = sortLabel();
    opt.hidden = !settings().enabled;
}

// ---------- likes ----------
// Likes belong to a character card, keyed by its avatar file (unique per card).

function likeCount(avatar) {
    return Number(settings().likes[avatar] ?? 0);
}

// Every change can be undone: the counts from before it are kept until the
// next change. Quick repeated taps on the same card count as one change, so
// Undo takes back the whole burst.
let lastChange = null; // { before: {likes, likeNames}, avatar, kind, at }

function snapshot() {
    const s = settings();
    return { likes: { ...s.likes }, likeNames: { ...s.likeNames } };
}

function likesChanged(avatar) {
    save();
    for (const btn of document.querySelectorAll('.uio-like')) {
        if (!avatar || btn.dataset.avatar === avatar) paintLike(btn);
    }
    renderTracker();
    stage.refresh('likes');
    document.dispatchEvent(new CustomEvent('uio:likes', { detail: { avatar: avatar ?? null, count: avatar ? likeCount(avatar) : null } }));
}

function remember(kind, avatar) {
    const now = Date.now();
    if (kind === 'tap' && lastChange?.kind === 'tap' && lastChange.avatar === avatar && now - lastChange.at < 6000) {
        lastChange.at = now; // same burst: keep the counts from before it began
        return;
    }
    lastChange = { before: snapshot(), avatar, kind, at: now };
}

function displayName(avatar) {
    return characterByAvatar(avatar)?.name ?? settings().likeNames[avatar] ?? String(avatar).replace(/\.png$/i, '');
}

function setLikes(avatar, count, name, kind = 'edit') {
    const s = settings();
    remember(kind, avatar);
    const n = Math.max(0, Math.round(count));
    if (n) s.likes[avatar] = n;
    else delete s.likes[avatar];
    if (name) s.likeNames[avatar] = name;
    likesChanged(avatar);
    const label = s.likeLabel;
    const message = kind === 'reset'
        ? `${displayName(avatar)}: ${label.toLowerCase()}s reset`
        : `${s.likeIcon} ${displayName(avatar)}: ${n}`;
    snack(message, true);
}

function resetAll() {
    const s = settings();
    if (!Object.keys(s.likes).length) return;
    remember('reset-all', null);
    s.likes = {};
    likesChanged(null);
    snack(`All ${s.likeLabel.toLowerCase()}s reset`, true);
}

function undo() {
    if (!lastChange) return false;
    const s = settings();
    const { before, avatar } = lastChange;
    lastChange = null;
    s.likes = before.likes;
    s.likeNames = before.likeNames;
    likesChanged(avatar);
    snack('Undone', false);
    return true;
}

// A small bar under the top bar: what changed, with an Undo button.
let snackTimer = null;
function snack(message, canUndo) {
    let bar = document.getElementById('uio-snack');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'uio-snack';
        bar.setAttribute('role', 'status');
        bar.innerHTML = '<span class="uio-snack-text"></span><button type="button" class="uio-snack-undo">Undo</button>';
        bar.querySelector('button').addEventListener('click', (event) => {
            event.stopPropagation();
            undo();
        });
        document.body.appendChild(bar);
    }
    bar.querySelector('.uio-snack-text').textContent = message;
    bar.querySelector('button').hidden = !canUndo;
    bar.classList.add('uio-show');
    clearTimeout(snackTimer);
    snackTimer = setTimeout(() => bar.classList.remove('uio-show'), canUndo ? 5000 : 1600);
}

function characterByAvatar(avatar) {
    return ctx().characters?.find(ch => ch.avatar === avatar) ?? null;
}

function paintLike(btn) {
    const s = settings();
    const n = likeCount(btn.dataset.avatar);
    btn.classList.toggle('uio-liked', n > 0);
    btn.innerHTML = `<span class="uio-like-icon">${escapeHtml(s.likeIcon)}</span><span class="uio-like-label">${escapeHtml(s.likeLabel)}</span>${n ? `<b class="uio-like-count">${n}</b>` : ''}`;
    btn.title = `${s.likeLabel}${n ? ` (${n})` : ''}`;
}

function makeLike(avatar, where) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `uio-like uio-like-${where}`;
    btn.dataset.avatar = avatar;
    paintLike(btn);
    return btn;
}

// ---------- fitting the chat to the real screen ----------
// Some phone browsers report the "visible screen height" CSS unit (100dvh)
// taller than what's actually visible, which pushes the bottom of the chat
// (the message box and anything under it) off screen. The real visible
// height is measured here and handed to CSS as --uio-vh.
function fitViewport() {
    const h = Math.round(window.innerHeight || document.documentElement.clientHeight || 0);
    if (h > 0) document.documentElement.style.setProperty('--uio-vh', `${h}px`);
}
fitViewport();
window.addEventListener('resize', fitViewport);
window.visualViewport?.addEventListener('resize', fitViewport);
window.addEventListener('orientationchange', () => setTimeout(fitViewport, 300));

const wrapped = createWrapped({
    ctx,
    settings,
    save,
    likeCount,
    mostLabel,
    tagNamesOf: (key) => tagNamesOf(key),
    escapeHtml,
    fullImageUrl: (src) => fullImageUrl(src),
});

const accents = createAccents({ ctx, settings, save, escapeHtml });
const accentState = {};

const creator = createCreator({
    ctx,
    settings,
    save,
    escapeHtml,
    accents,
    // In Stage mode a finished card opens its profile; otherwise its chat.
    openProfile: (index) => {
        if (!settings().complete) return ctx().selectCharacterById?.(index, { switchMenu: false });
        stage.profile(index);
    },
    refresh: () => {
        decorateAll();
        stage.refresh('cards');
    },
});

// Settings: accents for whoever is in the current chat, plus side characters.
function renderAccentSettings() {
    const box = document.getElementById('uio-accents');
    if (!box) return;
    const c = ctx();
    const cast = [];
    if (c.groupId) {
        const g = c.groups?.find(x => String(x.id) === String(c.groupId));
        for (const avatar of g?.members ?? []) {
            const index = (c.characters ?? []).findIndex(x => x?.avatar === avatar);
            if (index >= 0) cast.push({ index, ch: c.characters[index] });
        }
    } else if (c.characters?.[c.characterId]) {
        cast.push({ index: Number(c.characterId), ch: c.characters[c.characterId] });
    }
    const side = Object.entries(settings().accents ?? {}).filter(([k]) => k.startsWith('name:'));
    box.innerHTML = (cast.length ? cast.map(({ index, ch }) => `
        <details class="uio-acc-who"${cast.length === 1 ? ' open' : ''}>
            <summary><b>${escapeHtml(ch.name)}</b> <small>${escapeHtml(accents.describe(accents.get(accents.keyForCard(ch.avatar))))}</small></summary>
            ${accents.editorHtml(accents.keyForCard(ch.avatar), ch.name, { ...(accentState[accents.keyForCard(ch.avatar)] ?? {}), index })}
        </details>`).join('') : '<small class="uio-muted">Open a chat to set accents for its characters.</small>')
        + (side.length ? `<div class="uio-ins-title">Side characters</div>${side.map(([k, a]) => `
        <details class="uio-acc-who">
            <summary><b>${escapeHtml(a.displayName ?? k.slice(5))}</b> <small>${escapeHtml(accents.describe(a))}</small></summary>
            ${accents.editorHtml(k, a.displayName ?? k.slice(5), accentState[k] ?? {})}
        </details>`).join('')}` : '');
}

// Gives an element the Wrapped colours for the current like name.
function paintTheme(el) {
    if (!el) return;
    const t = wrappedTheme(settings().likeLabel, settings().likeIcon);
    el.style.setProperty('--w-a', t.a);
    el.style.setProperty('--w-b', t.b);
    el.style.setProperty('--w-c', t.c);
    el.style.setProperty('--w-glow', t.glow);
}

function renderRecaps() {
    const box = document.getElementById('uio-recaps');
    if (!box) return;
    paintTheme(document.getElementById('uio-settings'));
    const btn = document.getElementById('uio-wrap');
    if (btn) btn.innerHTML = `${escapeHtml(settings().likeIcon)} Your ${escapeHtml(settings().likeLabel)} Wrapped`;
    const list = wrapped.list();
    box.innerHTML = list.length
        ? list.map((r, i) => `<div class="uio-recap-row" data-recap="${i}" title="Replay this recap">
            <span>${escapeHtml(r.icon ?? '♥')}</span><b>${escapeHtml(r.ai?.title || 'Recap')}</b>
            <small>${new Date(r.at).toLocaleDateString()} · ${r.stats?.total ?? 0}</small></div>`).join('')
        : '<small class="uio-muted">No recaps yet. Each one is saved, and the next compares itself to it.</small>';
}

document.addEventListener('uio:recap', () => {
    renderRecaps();
    stage.refresh('cards');
});

const stage = createStage({
    ctx,
    settings,
    save,
    escapeHtml,
    likeCount,
    mostLabel,
    likeInsights,
    wrapped,
    paintTheme,
    accents,
    creator,
    like: (avatar) => setLikes(avatar, likeCount(avatar) + 1, characterByAvatar(avatar)?.name, 'tap'),
    fullImageUrl: (src) => fullImageUrl(src),
    reapply: () => {
        apply();
        const box = document.querySelector('#uio-settings [data-k="complete"]');
        if (box) box.checked = !!settings().complete;
    },
});

// Global so other extensions can read or add likes.
globalThis.UIOverhaul = {
    version: VERSION,
    getLikes: (avatar) => (avatar ? likeCount(avatar) : { ...settings().likes }),
    like: (avatar, by = 1) => setLikes(avatar, likeCount(avatar) + by, characterByAvatar(avatar)?.name),
    reset: (avatar) => (avatar ? setLikes(avatar, 0, null, 'reset') : resetAll()),
    undo,
};

// ---------- decorating SillyTavern's lists and chat ----------

// Which card a list entry shows. SillyTavern marks entries with data-chid (an
// index into the character list); the thumbnail's file name is used to check
// it, so a like always lands on the card that was tapped.
function entryAvatar(el) {
    const fromImg = /[?&]file=([^&]+)/.exec(el.querySelector('.avatar img')?.getAttribute('src') ?? '');
    const imgFile = fromImg ? decodeURIComponent(fromImg[1]) : null;
    const raw = el.getAttribute('data-chid') ?? el.getAttribute('chid');
    const ch = raw !== null && raw !== '' ? ctx().characters?.[Number(raw)] : null;
    if (ch?.avatar && (!imgFile || ch.avatar === imgFile)) return ch.avatar;
    return imgFile && characterByAvatar(imgFile) ? imgFile : null;
}

function decorateCharacters() {
    const block = document.getElementById('rm_print_characters_block');
    if (!block) return;
    for (const el of block.querySelectorAll('.character_select')) {
        const avatar = entryAvatar(el);
        let btn = el.querySelector('.uio-like');
        if (!avatar) {
            btn?.remove();
            continue;
        }
        if (btn && btn.dataset.avatar === avatar) {
            paintLike(btn);
            continue;
        }
        btn?.remove();
        btn = makeLike(avatar, 'list');
        el.appendChild(btn); // on the entry itself, so each style can place it freely
    }
}

function messageAvatar(mes) {
    const c = ctx();
    const msg = c.chat?.[Number(mes.getAttribute('mesid'))];
    if (!msg || msg.is_user || msg.is_system) return null;
    if (msg.original_avatar) return msg.original_avatar;
    if (c.characterId !== undefined && c.characterId !== null) return c.characters?.[c.characterId]?.avatar ?? null;
    return c.characters?.find(ch => ch.name === msg.name)?.avatar ?? null;
}

// Openings written by Stage's "Play this" end with an invisible marker; those
// messages get an outline and a small label so you can tell they're AI-made.
const AI_MARK = '\u2063\u2063';

// Greetings rewritten for your persona carry a different marker; they live
// only in that chat (as an extra swipe), never in the card.
const ADAPT_MARK = '\u2063\u2064';
const adapting = new Set(); // chat ids being adapted

function markAiMade(chatEl) {
    const chat = ctx().chat ?? [];
    for (const mes of chatEl.querySelectorAll('.mes')) {
        const id = Number(mes.getAttribute('mesid'));
        const msg = chat[id];
        const text = String(msg?.mes ?? '');
        const kind = !msg || msg.is_user ? null
            : text.includes(ADAPT_MARK) ? 'adapted'
                : text.includes(AI_MARK) ? 'opening' : null;
        mes.classList.toggle('uio-ai-made', !!kind);
        let label = mes.querySelector('.uio-ai-label');
        if (kind) {
            const who = msg.swipe_info?.[msg.swipe_id ?? 0]?.extra?.uio_adapted ?? msg.extra?.uio_adapted;
            const html = kind === 'adapted'
                ? `<i class="fa-solid fa-user-pen"></i> Adapted for ${escapeHtml(who ?? 'your persona')}`
                : '<i class="fa-solid fa-wand-magic-sparkles"></i> AI-written opening';
            if (!label) {
                label = document.createElement('span');
                label.className = 'uio-ai-label';
                mes.querySelector('.mes_block')?.appendChild(label);
            }
            if (label.innerHTML !== html) label.innerHTML = html;
        } else {
            label?.remove();
        }
        // A human-written greeting at the very start of a chat can be adapted.
        let btn = mes.querySelector('.uio-adapt');
        const canAdapt = id === 0 && msg && !msg.is_user && !kind && chat.length === 1;
        if (canAdapt && !btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'uio-adapt';
            mes.querySelector('.mes_block')?.appendChild(btn);
        }
        if (canAdapt) {
            const busy = adapting.has(ctx().getCurrentChatId?.() ?? 'chat');
            const html = busy
                ? '<i class="fa-solid fa-feather-pointed uio-writing"></i> Adapting…'
                : `<i class="fa-solid fa-user-pen"></i> Adapt to ${escapeHtml(ctx().name1 ?? 'my persona')}`;
            if (btn.innerHTML !== html) btn.innerHTML = html;
            btn.disabled = busy;
        } else {
            btn?.remove();
        }
    }
}

async function adaptGreeting() {
    const c = ctx();
    const chatId = c.getCurrentChatId?.() ?? 'chat';
    const msg = c.chat?.[0];
    if (!msg || msg.is_user || adapting.has(chatId)) return;
    adapting.add(chatId);
    decorateChat();
    try {
        const ch = c.characters?.[c.characterId];
        const persona = personaInfo(c);
        const original = String(msg.mes ?? '').replace(/[\u2062-\u2064]/g, '');
        const system = 'You adapt the opening message of a roleplay to the player\'s persona, for an adult fiction app with no content limits. Reply with the adapted message only.';
        const user = `Character: ${ch?.name ?? c.name2}\n` +
            (ch?.description ? `About them: ${cut(ch.description, 700)}\n` : '') +
            `\nThe player plays ${persona.name}${persona.desc ? `: ${cut(persona.desc, 700)}` : ' (no description)'}.\n\n` +
            `Opening message:\n${original}\n\n` +
            `Rewrite this opening so it fits ${persona.name} as described: gender and pronouns, body and appearance, clothing, species, role, and how the characters see, address and react to them. ` +
            'Keep everything else the same: the events, setting, the character\'s voice, formatting (*actions*, "speech"), length and tone. ' +
            'Change only what contradicts or ignores the persona; if little needs changing, change little. ' +
            `Never speak, act or decide for ${persona.name}. ${PRONOUNS} ${BLUNT}`;
        let text = await ask(c, system, user);
        text = text.replace(/^```[a-z]*\s*|```$/gi, '').trim();
        if (text.length < 20) throw new Error(text ? `The answer was too short: “${cut(text, 80)}”` : 'The answer came back empty.');
        const live = ctx().chat?.[0];
        if (!live || (ctx().getCurrentChatId?.() ?? 'chat') !== chatId) return; // chat changed meanwhile
        live.swipes = Array.isArray(live.swipes) && live.swipes.length ? live.swipes : [live.mes];
        live.swipe_info = Array.isArray(live.swipe_info) ? live.swipe_info : live.swipes.map(() => ({ send_date: live.send_date, extra: {} }));
        while (live.swipe_info.length < live.swipes.length) live.swipe_info.push({ send_date: live.send_date, extra: {} });
        live.swipes.push(`${text}${ADAPT_MARK}`);
        live.swipe_info.push({ send_date: live.send_date, gen_started: null, gen_finished: null, extra: { uio_adapted: persona.name } });
        await ctx().swipe.to(null, 'left', { source: 'swipe_picker', forceMesId: 0, forceSwipeId: live.swipes.length - 1, message: live });
        await ctx().saveChat?.();
    } catch (err) {
        console.error('[UI Overhaul] adapting the greeting failed', err);
        globalThis.toastr?.error?.(String(err?.message ?? err), 'Couldn\'t adapt the opening');
    } finally {
        adapting.delete(chatId);
        decorateChat();
    }
}

document.addEventListener('click', (event) => {
    if (!event.target.closest('.uio-adapt')) return;
    event.preventDefault();
    event.stopPropagation();
    adaptGreeting();
}, true);

function decorateChat() {
    const chatEl = document.getElementById('chat');
    if (!chatEl) return;
    markAiMade(chatEl);
    for (const mes of chatEl.querySelectorAll('.mes[is_user="false"]')) {
        const avatar = messageAvatar(mes);
        let btn = mes.querySelector('.uio-like');
        if (!avatar) {
            btn?.remove();
            continue;
        }
        if (btn && btn.dataset.avatar === avatar) {
            paintLike(btn);
            continue;
        }
        btn?.remove();
        btn = makeLike(avatar, 'chat');
        const spot = mes.querySelector('.ch_name .alignItemsBaseline') ?? mes.querySelector('.ch_name');
        spot?.appendChild(btn);
    }
}

function decorateAll() {
    if (!settings().enabled) {
        addSortOption();
        sharpenAll();
        return;
    }
    decorateCharacters();
    decorateChat();
    addSortOption();
    sharpenAll();
}

const observed = new WeakSet();
const RELEVANT = '.mes, .character_select, .avatar-container, .avatar, img';
function relevant(m) {
    if (m.type === 'attributes') return true;
    for (const n of m.addedNodes) if (n.nodeType === 1 && (n.matches(RELEVANT) || n.querySelector?.(RELEVANT))) return true;
    return false;
}
let decorateTimer = null;
function watch() {
    for (const id of ['rm_print_characters_block', 'chat', 'user_avatar_block']) {
        const el = document.getElementById(id);
        if (!el || observed.has(el)) continue;
        observed.add(el);
        new MutationObserver((mutations) => {
            // Text streaming into a message changes nothing here; only new
            // entries, messages or pictures need a look.
            if (!mutations.some(relevant)) return;
            clearTimeout(decorateTimer);
            decorateTimer = setTimeout(decorateAll, 80);
        }).observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    }
}

// Tapping Like adds one like and doesn't open the character.
document.addEventListener('click', (event) => {
    const btn = event.target.closest?.('.uio-like');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    const avatar = btn.dataset.avatar;
    setLikes(avatar, likeCount(avatar) + 1, characterByAvatar(avatar)?.name, 'tap');
    btn.classList.remove('uio-pop');
    void btn.offsetWidth;
    btn.classList.add('uio-pop');
}, true);

// ---------- settings + Like Tracker ----------

// ---------- like insights ----------
// Which tags your likes cluster on, and unliked cards that share them.
function tagNamesOf(key) {
    const c = ctx();
    return (c.tagMap?.[key] ?? []).map(id => c.tags?.find(t => t.id === id)?.name).filter(Boolean);
}

function likeInsights() {
    const c = ctx();
    const s = settings();
    const score = new Map();
    for (const [avatar, n] of Object.entries(s.likes)) {
        for (const t of tagNamesOf(avatar)) score.set(t, (score.get(t) ?? 0) + n);
    }
    const topTags = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const picks = [];
    (c.characters ?? []).forEach((ch, index) => {
        if (!ch?.avatar || likeCount(ch.avatar) > 0) return;
        const tags = tagNamesOf(ch.avatar);
        const shared = tags.filter(t => score.has(t)).sort((a, b) => score.get(b) - score.get(a));
        if (!shared.length) return;
        const points = shared.reduce((sum, t) => sum + score.get(t), 0) - (Number(ch.date_last_chat) ? 0.5 : 0);
        picks.push({ index, avatar: ch.avatar, name: ch.name, because: shared.slice(0, 2), points, played: !!Number(ch.date_last_chat) });
    });
    picks.sort((a, b) => b.points - a.points || Number(a.played) - Number(b.played));
    return { topTags, picks: picks.slice(0, 8) };
}

function renderInsights() {
    const box = document.getElementById('uio-insights');
    if (!box) return;
    const s = settings();
    const { topTags, picks } = likeInsights();
    if (!topTags.length) {
        box.innerHTML = `<small class="uio-muted">Insights appear once some ${escapeHtml(s.likeLabel.toLowerCase())}d cards have tags.</small>`;
        return;
    }
    const total = topTags.reduce((a, [, n]) => a + n, 0) || 1;
    box.innerHTML = `
        <div class="uio-ins-title">Your ${escapeHtml(s.likeLabel.toLowerCase())}s lean towards</div>
        ${topTags.map(([t, n]) => `<div class="uio-ins-bar"><span>#${escapeHtml(t)}</span><i style="width:${Math.max(6, Math.round(100 * n / topTags[0][1]))}%"></i><b>${escapeHtml(s.likeIcon)} ${n}</b></div>`).join('')}
        ${picks.length ? `<div class="uio-ins-title">You might like</div>
            <div class="uio-ins-picks">${picks.map(p => `
                <button type="button" class="uio-ins-pick" data-pick="${p.index}" title="Open ${escapeHtml(p.name)}">
                    <img src="${escapeHtml(thumb(p.avatar))}" alt="" loading="lazy">
                    <span>${escapeHtml(p.name)}</span>
                    <small>${p.because.map(t => `#${escapeHtml(t)}`).join(' ')}${p.played ? '' : ' · new'}</small>
                </button>`).join('')}</div>` : ''}`;
    void total;
}

function renderTracker() {
    renderInsights();
    renderRecaps();
    renderAccentSettings();
    const box = document.getElementById('uio-tracker');
    if (!box) return;
    const s = settings();
    const rows = Object.entries(s.likes).sort((a, b) => b[1] - a[1]);
    if (!rows.length) {
        box.innerHTML = `<small class="uio-muted">No ${escapeHtml(s.likeLabel.toLowerCase())}s yet. Tap ${escapeHtml(s.likeIcon)} ${escapeHtml(s.likeLabel)} on a character to add one.</small>`;
        return;
    }
    box.innerHTML = rows.map(([avatar, n]) => {
        const name = displayName(avatar);
        return `<div class="uio-track-row" data-avatar="${escapeHtml(avatar)}">
            <img src="${escapeHtml(thumb(avatar))}" alt="" loading="lazy">
            <span class="uio-track-name">${escapeHtml(name)}</span>
            <b class="uio-track-count">${escapeHtml(s.likeIcon)} ${n}</b>
            <button type="button" class="menu_button" data-t="-1" title="Remove one">−</button>
            <button type="button" class="menu_button" data-t="1" title="Add one">+</button>
            <button type="button" class="menu_button" data-t="reset" title="Reset to zero"><i class="fa-solid fa-rotate-left"></i></button>
        </div>`;
    }).join('');
}

function buildSettings() {
    const host = document.getElementById('extensions_settings2') ?? document.getElementById('extensions_settings');
    if (!host || document.getElementById('uio-settings')) return;
    const s = settings();
    const options = (list, cur) => list.map(([v, l]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${l}</option>`).join('');
    const wrap = document.createElement('div');
    wrap.id = 'uio-settings';
    wrap.innerHTML = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>UI Overhaul <small>v${VERSION}</small></b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <label class="checkbox_label"><input type="checkbox" data-k="enabled"> Enabled</label>
                <label class="checkbox_label uio-complete"><input type="checkbox" data-k="complete"> <span><b>Complete overhaul (Stage mode)</b><br><small>A different app on top of SillyTavern: a home screen for your cast, a full-screen chat with quick actions, and every menu as a tile in Backstage. Leave it from Backstage or here.</small></span></label>
                <b>Design</b>
                <div class="uio-presets">
                    <button type="button" class="menu_button" data-preset="gallery">Gallery</button>
                    <button type="button" class="menu_button" data-preset="reader">Reader</button>
                    <button type="button" class="menu_button" data-preset="messenger">Messenger</button>
                </div>
                <small class="uio-muted">Gallery is visual-first, Reader is text-first, Messenger feels like a chat app. Each area can be changed on its own below.</small>
                <label>Character list <select class="text_pole" data-k="charStyle">${options(STYLES.lists, s.charStyle)}</select></label>
                <label>Persona list <select class="text_pole" data-k="personaStyle">${options(STYLES.lists, s.personaStyle)}</select></label>
                <label>Chat <select class="text_pole" data-k="chatStyle">${options(STYLES.chat, s.chatStyle)}</select></label>
                <label>Accent colour <input type="color" data-k="accent"></label>
                <label class="checkbox_label"><input type="checkbox" data-k="chrome"> Match the top bar, panel headers, status button and FPS meter</label>
                <label class="checkbox_label"><input type="checkbox" data-k="sharp"> Sharp portraits (full-size images instead of small thumbnails)</label>
                <hr>
                <b>Like</b>
                <div class="uio-two">
                    <label>Button text <input class="text_pole" data-k="likeLabel" maxlength="20"></label>
                    <label>Icon <input class="text_pole" data-k="likeIcon" maxlength="4"></label>
                </div>
                <label class="checkbox_label"><input type="checkbox" data-k="likesInList"> Show on the character list</label>
                <label class="checkbox_label"><input type="checkbox" data-k="likesInChat"> Show on character messages in chat</label>
                <div class="uio-tracker-head">
                    <b>Like Tracker</b>
                    <button type="button" class="menu_button" id="uio-undo" title="Undo the last change"><i class="fa-solid fa-rotate-left"></i> Undo</button>
                    <button type="button" class="menu_button" id="uio-reset-all" title="Set every count to zero"><i class="fa-solid fa-trash-can"></i> Reset all</button>
                </div>
                <b>Characters</b>
                <div class="uio-presets">
                    <button type="button" class="menu_button" id="uio-generate"><i class="fa-solid fa-wand-magic-sparkles"></i> Generate a character</button>
                    <button type="button" class="menu_button" id="uio-findpic"><i class="fa-solid fa-image"></i> Picture for this character</button>
                </div>
                <b>Accents</b>
                <small class="uio-muted">Give characters an accent you can hear: their first language's grammar, rhythm and sounds in every line they speak.</small>
                <label class="checkbox_label"><input type="checkbox" data-k="accentWords"> Note words characters show they don't know</label>
                <div id="uio-accents"></div>
                <button type="button" class="menu_button uio-wrap-btn" id="uio-wrap"></button>
                <div id="uio-recaps" class="uio-recaps"></div>
                <div id="uio-insights"></div>
                <div id="uio-tracker"></div>
            </div>
        </div>`;
    host.appendChild(wrap);

    for (const input of wrap.querySelectorAll('[data-k]')) {
        const k = input.dataset.k;
        if (input.type === 'checkbox') input.checked = !!s[k];
        else input.value = s[k];
        const onChange = () => {
            if (input.type === 'checkbox') s[k] = input.checked;
            else if (input.type === 'color' || input.tagName === 'SELECT') s[k] = input.value;
            else s[k] = input.value.trim() || DEFAULTS[k];
            save();
            apply();
            for (const btn of document.querySelectorAll('.uio-like')) paintLike(btn);
            if (k === 'sharp' || k === 'enabled') for (const img of document.querySelectorAll(SHARP_SCOPE)) sharpen(img);
            renderTracker();
            stage.refresh('cards');
        };
        input.addEventListener(input.type === 'color' ? 'input' : 'change', onChange);
    }
    wrap.querySelector('.uio-presets').addEventListener('click', (event) => {
        const name = event.target.closest('[data-preset]')?.dataset.preset;
        if (!name) return;
        Object.assign(s, PRESETS[name]);
        for (const [k, v] of Object.entries(PRESETS[name])) wrap.querySelector(`[data-k="${k}"]`).value = v;
        save();
        apply();
    });
    wrap.querySelector('#uio-tracker').addEventListener('click', (event) => {
        const btn = event.target.closest('[data-t]');
        if (!btn) return;
        const avatar = btn.closest('[data-avatar]').dataset.avatar;
        if (btn.dataset.t === 'reset') setLikes(avatar, 0, null, 'reset');
        else setLikes(avatar, likeCount(avatar) + Number(btn.dataset.t), characterByAvatar(avatar)?.name);
    });
    wrap.querySelector('#uio-wrap').addEventListener('click', () => wrapped.make());
    wrap.querySelector('#uio-generate').addEventListener('click', () => creator.open());
    wrap.querySelector('#uio-findpic').addEventListener('click', () => {
        const c = ctx();
        const ch = c.characters?.[c.characterId];
        if (ch && !c.groupId) creator.picture(ch.avatar);
        else globalThis.toastr?.info?.('Open a chat with one character first.');
    });
    accents.bind(wrap.querySelector('#uio-accents'), renderAccentSettings, (key) => (accentState[key] ??= {}));
    wrap.querySelector('#uio-recaps').addEventListener('click', (event) => {
        const row = event.target.closest('[data-recap]');
        if (row) wrapped.replay(Number(row.dataset.recap));
    });
    wrap.querySelector('#uio-insights').addEventListener('click', async (event) => {
        const pick = event.target.closest('[data-pick]');
        if (!pick) return;
        const index = Number(pick.dataset.pick);
        if (settings().complete) return stage.profile(index);
        try { await ctx().selectCharacterById(index, { switchMenu: false }); } catch (err) { console.error(err); }
    });
    wrap.querySelector('#uio-undo').addEventListener('click', () => {
        if (!undo()) snack('Nothing to undo', false);
    });
    wrap.querySelector('#uio-reset-all').addEventListener('click', async () => {
        const s = settings();
        const total = Object.values(s.likes).reduce((a, b) => a + b, 0);
        if (!total) return snack(`No ${s.likeLabel.toLowerCase()}s to reset`, false);
        const question = `Reset all ${total} ${s.likeLabel.toLowerCase()}s on ${Object.keys(s.likes).length} cards? You can still undo it right after.`;
        const c = ctx();
        const ok = c.callGenericPopup && c.POPUP_TYPE
            ? await c.callGenericPopup(question, c.POPUP_TYPE.CONFIRM)
            : confirm(question);
        if (ok) resetAll();
    });
    renderTracker();
}

// ---------- start ----------

jQuery(() => {
    try {
        settings();
        buildSettings();
        apply();
        watch();
        const { eventSource, event_types: ev } = ctx();
        for (const name of ['CHAT_CHANGED', 'CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED', 'CHARACTER_EDITED', 'CHARACTER_PAGE_LOADED']) {
            if (ev[name]) eventSource.on(ev[name], () => {
                watch();
                clearTimeout(decorateTimer);
                decorateTimer = setTimeout(decorateAll, 80);
            });
        }
        // Accents: the prompt note follows the scene, refreshed before every reply.
        for (const name of ['CHAT_CHANGED', 'GENERATION_STARTED', 'MESSAGE_RECEIVED', 'GROUP_UPDATED']) {
            if (ev[name]) eventSource.on(ev[name], () => accents.update());
        }
        if (ev.CHAT_CHANGED) eventSource.on(ev.CHAT_CHANGED, () => renderAccentSettings());
        // Words a character asks about ("What is a 'mortgage'?") are noted as
        // words they don't know, so they stay consistent about it later.
        if (ev.CHARACTER_MESSAGE_RENDERED) eventSource.on(ev.CHARACTER_MESSAGE_RENDERED, (mesId) => {
            if (!settings().enabled || !settings().accentWords) return;
            const msg = ctx().chat?.[Number(mesId)];
            const found = accents.scanMessage(msg);
            for (const f of found) {
                globalThis.toastr?.info?.(`${f.name} doesn't know “${f.word}”. Noted under Accents; remove it there once they've learned it.`, 'New word', { timeOut: 5000 });
            }
            if (found.length) {
                renderAccentSettings();
                accents.update();
            }
        });
        // Stage mode follows chats, cards and status effects.
        if (ev.CHAT_CHANGED) eventSource.on(ev.CHAT_CHANGED, () => { stage.refresh('chat'); stage.chatOpened(); });
        for (const name of ['CHARACTER_PAGE_LOADED', 'CHARACTER_EDITED', 'CHARACTER_DELETED', 'GROUP_UPDATED', 'MESSAGE_RECEIVED', 'MESSAGE_SENT', 'MESSAGE_DELETED']) {
            if (ev[name]) eventSource.on(ev[name], () => stage.refresh(name === 'MESSAGE_RECEIVED' || name === 'MESSAGE_SENT' || name === 'MESSAGE_DELETED' ? 'bar' : 'cards'));
        }
        if (ev.PERSONA_CHANGED) eventSource.on(ev.PERSONA_CHANGED, () => stage.refresh('persona'));
        document.addEventListener('sillystatus:changed', () => stage.refresh('effects'));
    } catch (err) {
        console.error('[UI Overhaul] failed to start', err);
    }
});
