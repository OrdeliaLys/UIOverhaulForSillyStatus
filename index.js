// UI Overhaul for SillyTavern
// Restyles the character list, the persona list and the chat with a choice of
// design philosophies (Gallery, Reader, Messenger), and adds a Like button with
// a per-card Like Tracker. It only adds styles and small buttons: it never
// moves SillyTavern's own elements, so other extensions keep working.

const VERSION = '1.2.0';
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
    if (!s.enabled) return;
    body.classList.add('uio-on', `uio-chars-${s.charStyle}`, `uio-personas-${s.personaStyle}`, `uio-chat-${s.chatStyle}`);
    if (s.chrome) body.classList.add('uio-chrome');
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

function sortLabel() {
    const s = settings();
    const label = s.likeLabel.trim();
    return `${s.likeIcon} ${/^like$/i.test(label) ? 'Most liked' : `Most ${label}s`}`;
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
