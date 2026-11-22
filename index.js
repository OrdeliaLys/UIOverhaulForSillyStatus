// UI Overhaul for SillyTavern
// Restyles the character list, the persona list and the chat with a choice of
// design philosophies (Gallery, Reader, Messenger), and adds a Like button with
// a per-card Like Tracker. It only adds styles and small buttons: it never
// moves SillyTavern's own elements, so other extensions keep working.

const VERSION = '1.0.0';
const MODULE = 'ui_overhaul';

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
    if (!s.enabled) return;
    body.classList.add('uio-on', `uio-chars-${s.charStyle}`, `uio-personas-${s.personaStyle}`, `uio-chat-${s.chatStyle}`);
    if (!s.likesInList) body.classList.add('uio-no-list-likes');
    if (!s.likesInChat) body.classList.add('uio-no-chat-likes');
    body.style.setProperty('--uio-accent', s.accent);
    decorateAll();
}

// ---------- likes ----------
// Likes belong to a character card, keyed by its avatar file (unique per card).

function likeCount(avatar) {
    return Number(settings().likes[avatar] ?? 0);
}

function setLikes(avatar, count, name) {
    const s = settings();
    const n = Math.max(0, Math.round(count));
    if (n) s.likes[avatar] = n;
    else delete s.likes[avatar];
    if (name) s.likeNames[avatar] = name;
    save();
    for (const btn of document.querySelectorAll('.uio-like')) {
        if (btn.dataset.avatar === avatar) paintLike(btn);
    }
    renderTracker();
    document.dispatchEvent(new CustomEvent('uio:likes', { detail: { avatar, count: n } }));
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

// Global so other extensions can read or add likes.
globalThis.UIOverhaul = {
    version: VERSION,
    getLikes: (avatar) => (avatar ? likeCount(avatar) : { ...settings().likes }),
    like: (avatar, by = 1) => setLikes(avatar, likeCount(avatar) + by, characterByAvatar(avatar)?.name),
};

// ---------- decorating SillyTavern's lists and chat ----------

function decorateCharacters() {
    const block = document.getElementById('rm_print_characters_block');
    if (!block) return;
    const chars = ctx().characters ?? [];
    for (const el of block.querySelectorAll('.character_select')) {
        const ch = chars[Number(el.getAttribute('chid'))];
        if (!ch?.avatar) continue;
        let btn = el.querySelector('.uio-like');
        if (btn && btn.dataset.avatar === ch.avatar) {
            paintLike(btn);
            continue;
        }
        btn?.remove();
        btn = makeLike(ch.avatar, 'list');
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

function decorateChat() {
    const chatEl = document.getElementById('chat');
    if (!chatEl) return;
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
    if (!settings().enabled) return;
    decorateCharacters();
    decorateChat();
}

const observed = new WeakSet();
let decorateTimer = null;
function watch() {
    for (const id of ['rm_print_characters_block', 'chat']) {
        const el = document.getElementById(id);
        if (!el || observed.has(el)) continue;
        observed.add(el);
        new MutationObserver(() => {
            clearTimeout(decorateTimer);
            decorateTimer = setTimeout(decorateAll, 80);
        }).observe(el, { childList: true });
    }
}

// Tapping Like adds one like and doesn't open the character.
document.addEventListener('click', (event) => {
    const btn = event.target.closest?.('.uio-like');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    const avatar = btn.dataset.avatar;
    setLikes(avatar, likeCount(avatar) + 1, characterByAvatar(avatar)?.name);
    btn.classList.remove('uio-pop');
    void btn.offsetWidth;
    btn.classList.add('uio-pop');
}, true);

// ---------- settings + Like Tracker ----------

function renderTracker() {
    const box = document.getElementById('uio-tracker');
    if (!box) return;
    const s = settings();
    const rows = Object.entries(s.likes).sort((a, b) => b[1] - a[1]);
    if (!rows.length) {
        box.innerHTML = `<small class="uio-muted">No ${escapeHtml(s.likeLabel.toLowerCase())}s yet. Tap ${escapeHtml(s.likeIcon)} ${escapeHtml(s.likeLabel)} on a character to add one.</small>`;
        return;
    }
    box.innerHTML = rows.map(([avatar, n]) => {
        const name = characterByAvatar(avatar)?.name ?? s.likeNames[avatar] ?? avatar.replace(/\.png$/i, '');
        return `<div class="uio-track-row" data-avatar="${escapeHtml(avatar)}">
            <img src="${escapeHtml(thumb(avatar))}" alt="" loading="lazy">
            <span class="uio-track-name">${escapeHtml(name)}</span>
            <b class="uio-track-count">${escapeHtml(s.likeIcon)} ${n}</b>
            <button type="button" class="menu_button" data-t="-1" title="Remove one">−</button>
            <button type="button" class="menu_button" data-t="1" title="Add one">+</button>
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
                <hr>
                <b>Like</b>
                <div class="uio-two">
                    <label>Button text <input class="text_pole" data-k="likeLabel" maxlength="20"></label>
                    <label>Icon <input class="text_pole" data-k="likeIcon" maxlength="4"></label>
                </div>
                <label class="checkbox_label"><input type="checkbox" data-k="likesInList"> Show on the character list</label>
                <label class="checkbox_label"><input type="checkbox" data-k="likesInChat"> Show on character messages in chat</label>
                <b>Like Tracker</b>
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
            renderTracker();
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
        setLikes(avatar, likeCount(avatar) + Number(btn.dataset.t), characterByAvatar(avatar)?.name);
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
        for (const name of ['CHAT_CHANGED', 'CHARACTER_MESSAGE_RENDERED', 'MESSAGE_SWIPED', 'CHARACTER_EDITED', 'CHARACTER_PAGE_LOADED']) {
            if (ev[name]) eventSource.on(ev[name], () => {
                watch();
                clearTimeout(decorateTimer);
                decorateTimer = setTimeout(decorateAll, 80);
            });
        }
    } catch (err) {
        console.error('[UI Overhaul] failed to start', err);
    }
});
