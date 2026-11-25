import { ask as askAI, cut as cutText, personaInfo, BLUNT, PRONOUNS } from './ai.js';

// Stage mode: a complete overhaul of SillyTavern's interface.
//
// SillyTavern keeps doing all the work underneath (chats, generation, cards,
// presets, extensions). Stage replaces the way you get around it:
//
//   Home       a portrait-first cast screen: continue where you left off, your
//              most-liked cards, search, sort and tag filters, groups included.
//   Chat       full-screen, with a slim top bar (who you're talking to, their
//              status effects, likes) and quick actions above the message box.
//   Backstage  every SillyTavern menu as a labelled tile; each opens as a
//              full-screen sheet with a clear way back.
//
// Nothing of SillyTavern's is removed or rewritten: its top bar is hidden and
// its menus are shown differently, so turning Stage off restores everything.

const BACKSTAGE = [
    { drawer: 'ai-config-button', icon: 'fa-sliders', title: 'Responses', sub: 'Presets, length, temperature, samplers' },
    { drawer: 'sys-settings-button', icon: 'fa-plug', title: 'Connection', sub: 'API, key and model' },
    { drawer: 'advanced-formatting-button', icon: 'fa-font', title: 'Prompt format', sub: 'Context, instruct and system prompt' },
    { drawer: 'WI-SP-button', icon: 'fa-book-atlas', title: 'Lore', sub: 'World info and lorebooks' },
    { drawer: 'persona-management-button', icon: 'fa-face-smile', title: 'Personas', sub: 'Who you play' },
    { drawer: 'rightNavHolder', icon: 'fa-address-card', title: 'Characters', sub: 'Classic list, editing and import' },
    { drawer: 'user-settings-button', icon: 'fa-user-gear', title: 'Appearance', sub: 'Theme, chat display, behaviour' },
    { drawer: 'backgrounds-button', icon: 'fa-panorama', title: 'Backgrounds', sub: 'Chat backdrops' },
    { drawer: 'extensions-settings-button', icon: 'fa-cubes', title: 'Extensions', sub: 'Add-ons and their settings' },
];

const SORTS = [
    ['recent', 'Recent'],
    ['liked', 'Most liked'],
    ['fav', 'Favourites'],
    ['az', 'A–Z'],
    ['new', 'Newest'],
];

export function createStage(h) {
    // h: { ctx, settings, save, likeCount, like, escapeHtml, fullImageUrl }
    const esc = h.escapeHtml;
    const state = { on: false, view: 'home', query: '', tag: null, dirty: true };
    let els = null;

    // ---------- small helpers ----------

    const $ = (sel, root = document) => root.querySelector(sel);
    const settings = () => h.settings();
    const thumb = (type, file) => `/thumbnail?type=${type}&file=${encodeURIComponent(file)}`;

    function img(type, file, cls = '') {
        const src = thumb(type, file);
        const full = settings().sharp ? h.fullImageUrl(src) : null;
        return `<img class="${cls}" src="${esc(src)}"${full ? ` srcset="${esc(full)}"` : ''} loading="lazy" decoding="async" alt="">`;
    }

    function ago(ms) {
        if (!ms) return '';
        const m = Math.round((Date.now() - ms) / 60000);
        if (m < 1) return 'just now';
        if (m < 60) return `${m} min ago`;
        const hr = Math.round(m / 60);
        if (hr < 24) return `${hr} h ago`;
        const d = Math.round(hr / 24);
        if (d < 30) return `${d} d ago`;
        return new Date(ms).toLocaleDateString();
    }

    function clean(text, name) {
        return String(text ?? '')
            .replace(/\{\{char\}\}/gi, name ?? 'They')
            .replace(/\{\{user\}\}/gi, h.ctx().name1 ?? 'you')
            .replace(/<[^>]+>/g, ' ')
            .replace(/[*_#>`]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 140);
    }

    function tagNames(key) {
        const c = h.ctx();
        const ids = c.tagMap?.[key] ?? [];
        return ids.map(id => c.tags?.find(t => t.id === id)?.name).filter(Boolean);
    }

    function entities() {
        const c = h.ctx();
        const list = [];
        (c.characters ?? []).forEach((ch, i) => {
            if (!ch?.avatar) return;
            list.push({
                type: 'char', id: i, key: ch.avatar, name: ch.name, avatar: ch.avatar,
                fav: ch.fav === true || ch.fav === 'true',
                last: Number(ch.date_last_chat) || 0,
                added: Number(ch.date_added) || Date.parse(ch.create_date) || 0,
                blurb: clean(ch.data?.creator_notes || ch.creatorcomment || ch.description, ch.name),
                tags: tagNames(ch.avatar),
                likes: h.likeCount(ch.avatar),
            });
        });
        (c.groups ?? []).forEach((g) => {
            list.push({
                type: 'group', id: g.id, key: g.id, name: g.name, members: g.members ?? [],
                fav: g.fav === true || g.fav === 'true',
                last: Number(g.date_last_chat) || 0,
                added: Number(g.create_date) || 0,
                blurb: `Group · ${(g.members ?? []).length} characters`,
                tags: tagNames(g.id),
                likes: 0,
            });
        });
        return list;
    }

    function isActive(e) {
        const c = h.ctx();
        if (e.type === 'group') return String(c.groupId ?? '') === String(e.id);
        return !c.groupId && String(c.characterId ?? '') === String(e.id);
    }

    function hasChat() {
        const c = h.ctx();
        return !!c.groupId || (c.characterId !== undefined && c.characterId !== null && c.characterId !== '');
    }

    function current() {
        const c = h.ctx();
        if (c.groupId) {
            const g = c.groups?.find(x => String(x.id) === String(c.groupId));
            return g ? { type: 'group', id: g.id, name: g.name, members: g.members ?? [] } : null;
        }
        const ch = c.characters?.[c.characterId];
        return ch ? { type: 'char', id: c.characterId, name: ch.name, avatar: ch.avatar } : null;
    }

    function portrait(e, cls) {
        if (e.type === 'group') {
            const m = (e.members ?? []).slice(0, 3);
            if (!m.length) return `<div class="${cls} uix-group-pic"><i class="fa-solid fa-users"></i></div>`;
            return `<div class="${cls} uix-group-pic uix-n${m.length}">${m.map(a => img('avatar', a)).join('')}</div>`;
        }
        return `<div class="${cls}">${img('avatar', e.avatar)}</div>`;
    }

    // ---------- building the shell ----------

    function build() {
        if (els) return;
        const home = document.createElement('div');
        home.id = 'uix-home';
        home.innerHTML = `
            <header class="uix-home-top">
                <button type="button" class="uix-persona" data-act="persona" title="Switch persona"></button>
                <div class="uix-wordmark">Stage</div>
                <button type="button" class="uix-icon" data-act="backstage" title="Backstage (all settings)"><i class="fa-solid fa-gear"></i></button>
            </header>
            <div class="uix-home-body">
                <h1 class="uix-greet"></h1>
                <section class="uix-hero"></section>
                <section class="uix-wrapbox"></section>
                <section class="uix-liked"></section>
                <section class="uix-suggest"></section>
                <div class="uix-searchbar">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="search" class="uix-search" placeholder="Search the cast" autocomplete="off">
                </div>
                <div class="uix-chips uix-sorts"></div>
                <div class="uix-chips uix-tags"></div>
                <div class="uix-grid"></div>
            </div>
            <button type="button" class="uix-fab" data-act="new" title="New"><i class="fa-solid fa-plus"></i></button>`;

        const bar = document.createElement('div');
        bar.id = 'uix-bar';
        bar.innerHTML = `
            <button type="button" class="uix-icon" data-act="home" title="Home"><i class="fa-solid fa-chevron-left"></i></button>
            <button type="button" class="uix-who" data-act="who" title="Profile"></button>
            <button type="button" class="uix-effects" data-act="effects" title="Status effects"></button>
            <button type="button" class="uix-barlike" data-act="like" title="Like"></button>
            <button type="button" class="uix-icon" data-act="actions" title="More"><i class="fa-solid fa-ellipsis-vertical"></i></button>`;

        const backstage = document.createElement('div');
        backstage.id = 'uix-backstage';
        backstage.innerHTML = `
            <header class="uix-sheet-top">
                <button type="button" class="uix-icon" data-act="close-backstage" title="Back"><i class="fa-solid fa-chevron-left"></i></button>
                <b>Backstage</b>
                <span></span>
            </header>
            <div class="uix-tiles">${BACKSTAGE.map(t => `
                <button type="button" class="uix-tile" data-drawer="${t.drawer}">
                    <i class="fa-solid ${t.icon}"></i><b>${t.title}</b><small>${t.sub}</small>
                </button>`).join('')}
            </div>
            <button type="button" class="uix-exit" data-act="exit"><i class="fa-solid fa-door-open"></i> Leave Stage mode</button>
            <small class="uix-foot">Stage mode is part of UI Overhaul. It can also be switched off under Extensions → UI Overhaul.</small>`;

        const sheetHead = document.createElement('div');
        sheetHead.id = 'uix-sheethead';
        sheetHead.innerHTML = `<button type="button" class="uix-done" data-act="close-drawer"><i class="fa-solid fa-chevron-left"></i> <span>Back</span></button><b class="uix-sheet-title"></b><span></span>`;

        const menu = document.createElement('div');
        menu.id = 'uix-menu';
        menu.innerHTML = '<div class="uix-scrim" data-act="close-menu"></div><div class="uix-menu-panel"></div>';

        const quick = document.createElement('div');
        quick.id = 'uix-quick';
        quick.innerHTML = `
            <button type="button" data-q="reroll"><i class="fa-solid fa-rotate"></i> Reroll</button>
            <button type="button" data-q="swipe"><i class="fa-solid fa-arrow-right-arrow-left"></i> Swipe</button>
            <button type="button" data-q="continue"><i class="fa-solid fa-forward"></i> Continue</button>
            <button type="button" data-q="impersonate"><i class="fa-solid fa-user-pen"></i> Write mine</button>
            <button type="button" data-q="ooc"><i class="fa-solid fa-masks-theater"></i> OOC</button>
            <button type="button" data-q="text"><i class="fa-solid fa-mobile-screen"></i> Text</button>`;

        document.body.append(home, bar, backstage, sheetHead, menu);
        els = { home, bar, backstage, sheetHead, menu, quick };

        for (const root of [home, bar, backstage, sheetHead, menu]) root.addEventListener('click', onClick);
        bindAccents();
        quick.addEventListener('click', onQuick);
        $('.uix-search', home).addEventListener('input', (e) => {
            state.query = e.target.value.trim().toLowerCase();
            renderGrid();
        });
        watchDrawers();
    }

    function placeQuick() {
        const form = document.getElementById('form_sheld');
        const send = document.getElementById('send_form');
        if (form && send && els.quick.parentElement !== form) form.insertBefore(els.quick, send);
    }

    // ---------- home ----------

    function renderHome() {
        if (!els) return;
        state.dirty = false;
        const c = h.ctx();
        const hour = new Date().getHours();
        const part = hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
        $('.uix-greet', els.home).textContent = `${part}, ${c.name1 ?? ''}`.replace(/, $/, '');
        renderPersonaChip();

        const all = entities();
        // Continue: the open chat first, otherwise the most recent one.
        const active = all.find(isActive);
        const recent = [...all].sort((a, b) => b.last - a.last).filter(e => e.last);
        const hero = active ?? recent[0];
        const heroEl = $('.uix-hero', els.home);
        if (hero) {
            heroEl.hidden = false;
            heroEl.innerHTML = `
                <button type="button" class="uix-hero-card" data-open="${hero.type}:${esc(hero.id)}">
                    ${portrait(hero, 'uix-hero-pic')}
                    <span class="uix-hero-text">
                        <small>${active ? 'Your story with' : 'Pick up with'}</small>
                        <b>${esc(hero.name)}</b>
                        <span class="uix-hero-meta">${esc(hero.last ? ago(hero.last) : '')}</span>
                        <span class="uix-hero-go">Continue <i class="fa-solid fa-arrow-right"></i></span>
                    </span>
                </button>
                ${recent.filter(e => e !== hero).slice(0, 8).length ? `<div class="uix-row">${recent.filter(e => e !== hero).slice(0, 8).map(e => `
                    <button type="button" class="uix-mini" data-open="${e.type}:${esc(e.id)}">
                        ${portrait(e, 'uix-mini-pic')}<span>${esc(e.name)}</span><small>${esc(ago(e.last))}</small>
                    </button>`).join('')}</div>` : ''}`;
        } else {
            heroEl.hidden = true;
        }

        const s = settings();
        // Wrapped banner, coloured by what likes are called
        const wrapEl = $('.uix-wrapbox', els.home);
        const totalLikes = all.reduce((a, e) => a + e.likes, 0);
        if (h.wrapped && totalLikes > 0) {
            const last = h.wrapped.list()[0];
            const fresh = h.wrapped.newSinceLast();
            const many = /s$/i.test(s.likeLabel) ? s.likeLabel : `${s.likeLabel}s`;
            wrapEl.hidden = false;
            wrapEl.innerHTML = `<button type="button" class="uix-wrap-banner" data-act="wrapped">
                <span class="uix-wrap-icon">${esc(s.likeIcon)}</span>
                <span><b>Your ${esc(s.likeLabel)} Wrapped</b>
                <small>${last
                    ? `Last one ${esc(ago(last.at))}${fresh > 0 ? ` · ${fresh} new ${esc(many.toLowerCase())} since` : ''}`
                    : `See what your ${totalLikes} ${esc(many.toLowerCase())} say about you`}</small></span>
                <i class="fa-solid fa-chevron-right"></i></button>`;
            h.paintTheme?.(wrapEl.firstElementChild);
        } else {
            wrapEl.hidden = true;
        }
        const liked = all.filter(e => e.likes > 0).sort((a, b) => b.likes - a.likes).slice(0, 10);
        const likedEl = $('.uix-liked', els.home);
        likedEl.hidden = !liked.length;
        likedEl.innerHTML = liked.length ? `
            <h2>${esc(s.likeIcon)} ${esc(h.mostLabel())}</h2>
            <div class="uix-row">${liked.map(e => `
                <button type="button" class="uix-mini" data-open="${e.type}:${esc(e.id)}">
                    ${portrait(e, 'uix-mini-pic')}<span>${esc(e.name)}</span><small>${esc(s.likeIcon)} ${e.likes}</small>
                </button>`).join('')}</div>` : '';

        const picks = h.likeInsights?.().picks ?? [];
        const sugEl = $('.uix-suggest', els.home);
        sugEl.hidden = !picks.length;
        sugEl.innerHTML = picks.length ? `
            <h2>You might like</h2>
            <div class="uix-row">${picks.slice(0, 8).map(p => `
                <button type="button" class="uix-mini" data-profile="${p.index}">
                    ${portrait({ type: 'char', avatar: p.avatar }, 'uix-mini-pic')}<span>${esc(p.name)}</span><small>${esc(p.because.map(t => `#${t}`).join(' '))}</small>
                </button>`).join('')}</div>` : '';

        $('.uix-sorts', els.home).innerHTML = SORTS.map(([k, l]) => [k, k === 'liked' ? h.mostLabel() : l]).map(([k, l]) =>
            `<button type="button" class="uix-chip${(s.stageSort ?? 'recent') === k ? ' uix-on' : ''}" data-sort="${k}">${l}</button>`).join('');

        const counts = new Map();
        for (const e of all) for (const t of e.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
        const tags = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([t]) => t);
        if (state.tag && !counts.has(state.tag)) state.tag = null;
        $('.uix-tags', els.home).innerHTML = tags.map(t =>
            `<button type="button" class="uix-chip uix-tagchip${state.tag === t ? ' uix-on' : ''}" data-tag="${esc(t)}">#${esc(t)}</button>`).join('');
        $('.uix-tags', els.home).hidden = !tags.length;
        renderGrid(all);
    }

    function renderGrid(all = entities()) {
        const s = settings();
        const sort = s.stageSort ?? 'recent';
        let list = all;
        if (state.query) list = list.filter(e => `${e.name} ${e.tags.join(' ')}`.toLowerCase().includes(state.query));
        if (state.tag) list = list.filter(e => e.tags.includes(state.tag));
        const by = {
            recent: (a, b) => b.last - a.last || a.name.localeCompare(b.name),
            liked: (a, b) => b.likes - a.likes || b.last - a.last,
            fav: (a, b) => Number(b.fav) - Number(a.fav) || b.last - a.last,
            az: (a, b) => a.name.localeCompare(b.name),
            new: (a, b) => b.added - a.added,
        }[sort];
        list = [...list].sort(by);
        const grid = $('.uix-grid', els.home);
        if (!list.length) {
            grid.innerHTML = `<p class="uix-empty">${state.query || state.tag ? 'Nobody matches that.' : 'No characters yet. Tap + to make or import one.'}</p>`;
            return;
        }
        grid.innerHTML = list.map(e => `
            <div class="uix-card${isActive(e) ? ' uix-active' : ''}" ${e.type === 'char' ? `data-profile="${esc(e.id)}"` : `data-open="${e.type}:${esc(e.id)}"`} role="button" tabindex="0">
                ${portrait(e, 'uix-card-pic')}
                ${e.fav ? '<i class="fa-solid fa-star uix-fav"></i>' : ''}
                ${e.type === 'char' ? `<button type="button" class="uix-cardlike${e.likes ? ' uix-liked' : ''}" data-like="${esc(e.avatar)}">${esc(s.likeIcon)}${e.likes ? ` <b>${e.likes}</b>` : ''}</button>` : ''}
                <div class="uix-card-text">
                    <b>${esc(e.name)}</b>
                    ${e.blurb ? `<span>${esc(e.blurb)}</span>` : ''}
                    ${e.last ? `<small>${esc(ago(e.last))}</small>` : ''}
                </div>
            </div>`).join('');
    }

    // The persona in use, by its avatar file (names can repeat; files can't).
    let chosenPersona = null;
    function currentPersona() {
        const c = h.ctx();
        const personas = c.powerUserSettings?.personas ?? {};
        const known = (a) => (a && Object.prototype.hasOwnProperty.call(personas, a) ? a : null);
        // 1. SillyTavern's persona list marks the selected one.
        const sel = known(document.querySelector('#user_avatar_block .avatar-container.selected')?.getAttribute('data-avatar-id'));
        if (sel) return sel;
        // 2. Your messages in the open chat show the current persona's picture.
        for (const im of document.querySelectorAll('#chat .mes[is_user="true"]:not([force_avatar="true"]) .avatar img')) {
            const m = /[?&]type=persona&file=([^&]+)/.exec(im.getAttribute('src') ?? '');
            const file = known(m ? decodeURIComponent(m[1]) : null);
            if (file) return file;
        }
        // 3. The last one picked here, if it still has the current name.
        if (chosenPersona && personas[chosenPersona] === c.name1) return chosenPersona;
        // 4. Otherwise match by name.
        return Object.keys(personas).find(a => personas[a] === c.name1) ?? null;
    }

    function renderPersonaChip() {
        const chip = $('.uix-persona', els.home);
        const avatar = currentPersona();
        chip.innerHTML = `${avatar ? img('persona', avatar) : '<i class="fa-solid fa-user"></i>'}<span>${esc(h.ctx().name1 ?? 'You')}</span><i class="fa-solid fa-chevron-down"></i>`;
    }

    // ---------- chat bar ----------

    function renderBar() {
        if (!els) return;
        const who = current();
        const s = settings();
        const whoEl = $('.uix-who', els.bar);
        if (!who) {
            whoEl.innerHTML = '<b>No chat open</b>';
        } else {
            const sub = who.type === 'group'
                ? `${who.members.length} characters`
                : (h.ctx().chat?.length ? `${h.ctx().chat.length} messages` : 'New story');
            whoEl.innerHTML = `${portrait(who, 'uix-who-pic')}<span><b>${esc(who.name)}</b><small>${esc(sub)}</small></span>`;
        }
        const likeEl = $('.uix-barlike', els.bar);
        if (who?.type === 'char') {
            const n = h.likeCount(who.avatar);
            likeEl.hidden = false;
            likeEl.dataset.like = who.avatar;
            likeEl.classList.toggle('uix-liked', n > 0);
            likeEl.innerHTML = `${esc(s.likeIcon)}${n ? ` <b>${n}</b>` : ''}`;
        } else {
            likeEl.hidden = true;
        }
        renderEffects();
    }

    function renderEffects() {
        if (!els) return;
        const box = $('.uix-effects', els.bar);
        const list = globalThis.SillyStatus?.getEffects?.() ?? [];
        if (!globalThis.SillyStatus || !document.getElementById('sfx-toggle')) {
            box.hidden = true;
            return;
        }
        box.hidden = false;
        if (!list.length) {
            box.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
            box.classList.add('uix-none');
            return;
        }
        box.classList.remove('uix-none');
        const shown = list.slice(0, 3);
        box.innerHTML = shown.map(e => {
            const p = Math.round(100 * (Number(e.stage) || 0) / Math.max(1, Number(e.max) || 1));
            return `<span class="uix-fx" style="--p:${p}%" title="${esc(e.name)} ${e.stage}/${e.max}"><span>${esc(e.icon || '✦')}</span></span>`;
        }).join('') + (list.length > shown.length ? `<small>+${list.length - shown.length}</small>` : '');
    }

    // ---------- navigation ----------

    function show(view) {
        state.view = view;
        setTimeout(guardBack, 0);
        document.body.classList.toggle('uix-home', view === 'home');
        if (view === 'home') {
            renderHome();
            els.home.scrollTop = 0;
        } else {
            renderBar();
            placeQuick();
        }
    }

    async function open(spec) {
        const [type, ...rest] = spec.split(':');
        const id = rest.join(':');
        const c = h.ctx();
        const e = { type, id };
        try {
            if (!isActive(e)) {
                if (type === 'char') await c.selectCharacterById(Number(id), { switchMenu: false });
                else {
                    const g = c.groups?.find(x => String(x.id) === id);
                    if (g) await c.executeSlashCommandsWithOptions(`/go ${JSON.stringify(g.name)}`);
                }
            }
        } catch (err) {
            console.error('[UI Overhaul] could not open chat', err);
        }
        show('chat');
    }

    function clickId(id) {
        const el = document.getElementById(id);
        if (el) el.click();
        return !!el;
    }

    function toggleDrawer(drawerId) {
        document.querySelector(`#${drawerId} > .drawer-toggle`)?.click();
    }

    function drawerOpen(drawerId) {
        return !!document.querySelector(`#${drawerId} > .drawer-content.openDrawer`);
    }

    function openDrawer(drawerId) {
        if (!drawerOpen(drawerId)) toggleDrawer(drawerId);
    }

    function openCard() {
        openDrawer('rightNavHolder');
        setTimeout(() => clickId('rm_button_selected_ch') || document.querySelector('#rm_button_selected_ch h2')?.click(), 60);
    }

    function openFromCharacterPanel(buttonId) {
        openDrawer('rightNavHolder');
        setTimeout(() => {
            clickId('rm_button_characters');
            setTimeout(() => clickId(buttonId), 60);
        }, 60);
    }

    // Which SillyTavern menu is open: shown as a full-screen sheet with a
    // header that says what it is and how to get back.
    function watchDrawers() {
        const holder = document.getElementById('top-settings-holder');
        if (!holder) return;
        const update = () => {
            const open = holder.querySelector(':scope > .drawer > .drawer-content.openDrawer');
            const drawer = open?.parentElement?.id;
            const meta = BACKSTAGE.find(t => t.drawer === drawer);
            document.body.classList.toggle('uix-sheet', !!open && state.on);
            if (open) {
                $('.uix-sheet-title', els.sheetHead).textContent = meta?.title ?? 'Settings';
                els.sheetHead.dataset.drawer = drawer ?? '';
                guardBack();
            }
        };
        new MutationObserver(update).observe(holder, { subtree: true, attributes: true, attributeFilter: ['class'] });
        update();
    }

    // ---------- sheets ----------

    function sheet(title, rows) {
        const panel = $('.uix-menu-panel', els.menu);
        panel.innerHTML = `<div class="uix-grab"></div>${title ? `<b class="uix-menu-title">${esc(title)}</b>` : ''}${rows.join('')}`;
        els.menu.classList.add('uix-open');
        guardBack();
    }

    const row = (act, icon, label, sub = '', extra = '') =>
        `<button type="button" class="uix-menu-row${extra}" data-act="${act}"><i class="fa-solid ${icon}"></i><span><b>${esc(label)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;

    function actionsSheet() {
        const who = current();
        sheet(who?.name ?? 'Chat', [
            row('m:start_new_chat', 'fa-comments', 'New chat', 'Start this story over in a fresh chat'),
            row('m:select_chat', 'fa-clock-rotate-left', 'Chat history', 'Other chats with this character'),
            row('card', 'fa-id-card', who?.type === 'group' ? 'Group settings' : 'Character card', 'Description, greeting, personality'),
            row('effects', 'fa-wand-magic-sparkles', 'Status effects', 'Open the SillyStatus panel'),
            row('cast', 'fa-people-group', 'Cast board', 'Characters met in this chat; turn them into cards'),
            row('m:toggle_AN', 'fa-note-sticky', "Author's note", 'A standing note for the AI'),
            row('m:delete_mes', 'fa-trash-can', 'Delete messages', 'Pick messages to remove'),
            ...(who?.type === 'char' ? [row('m:convert_to_group', 'fa-users-rays', 'Make it a group', 'Bring more characters in')] : []),
            row('backstage', 'fa-gear', 'Backstage', 'All settings'),
            row('closechat', 'fa-xmark', 'Close chat', '', ' uix-danger'),
        ]);
    }

    function newSheet() {
        sheet('Add to the cast', [
            row('n:create', 'fa-user-plus', 'New character', 'Write a card from scratch'),
            row('n:import', 'fa-file-import', 'Import a card', 'PNG, JSON, CHARX or YAML file'),
            row('n:url', 'fa-cloud-arrow-down', 'Import from a link', 'Chub, JanitorAI and other sites'),
            row('n:group', 'fa-users', 'New group', 'Several characters in one chat'),
        ]);
    }

    function personaSheet() {
        const pu = h.ctx().powerUserSettings ?? {};
        const personas = Object.entries(pu.personas ?? {});
        const cur = currentPersona();
        const panel = $('.uix-menu-panel', els.menu);
        panel.innerHTML = `<div class="uix-grab"></div><b class="uix-menu-title">Play as</b>
            <div class="uix-personas">${personas.map(([avatar, name]) => `
                <button type="button" class="uix-pers${avatar === cur ? ' uix-on' : ''}" data-persona="${esc(avatar)}">
                    ${img('persona', avatar)}<b>${esc(name)}</b>
                    <small>${esc(clean(pu.persona_descriptions?.[avatar]?.description ?? '', name).slice(0, 60))}</small>
                </button>`).join('')}
            </div>
            ${row('drawer:persona-management-button', 'fa-face-smile', 'Manage personas', 'Create, edit and connect personas')}`;
        els.menu.classList.add('uix-open');
        guardBack();
    }

    function closeMenu() {
        accentSheetFor = null;
        els.menu.classList.remove('uix-open', 'uix-profile-open');
        profileFor = null;
        if (state.dirty && state.view === 'home') renderHome();
    }

    // Switches by the persona's avatar file, so personas that share a name
    // are told apart. Uses SillyTavern's own persona list when it's on screen,
    // otherwise its /persona-set command in lookup mode (which never renames
    // you when nothing matches).
    async function switchPersona(avatar) {
        closeMenu();
        if (avatar === currentPersona()) return;
        chosenPersona = avatar;
        try {
            const el = document.querySelector(`#user_avatar_block .avatar-container[data-avatar-id="${CSS.escape(avatar)}"]`);
            if (el) el.click();
            else await h.ctx().executeSlashCommandsWithOptions(`/persona-set mode=lookup ${JSON.stringify(avatar)}`);
        } catch (err) {
            console.error('[UI Overhaul] could not switch persona', err);
        }
        setTimeout(() => { renderPersonaChip(); if (state.view === 'home') renderHome(); }, 300);
    }

    // ---------- profile and story ideas ----------
    // Inspecting a card shows a profile. The first time, the AI is asked for a
    // short pitch and a few chat ideas (where a story could start and where it
    // could lead). They're saved per card; Retry asks again.

    let profileFor = null;       // character index on show
    const pitching = new Map();  // avatar -> running request

    function pitches() {
        const s = settings();
        if (!s.pitches || typeof s.pitches !== 'object') s.pitches = {};
        return s.pitches;
    }

    function cut(text, n) {
        const t = String(text ?? '').trim();
        return t.length > n ? `${t.slice(0, n)}…` : t;
    }

    function personaBrief() {
        const c = h.ctx();
        const pu = c.powerUserSettings ?? {};
        const avatar = currentPersona();
        const desc = avatar ? pu.persona_descriptions?.[avatar]?.description : '';
        return { name: c.name1 ?? 'User', desc: cut(String(desc ?? '').replace(/\{\{user\}\}/gi, c.name1 ?? 'User'), 400) };
    }

    function cardText(full, player) {
        const fill = (t) => String(t ?? '').replace(/\{\{char\}\}/gi, full.name).replace(/\{\{user\}\}/gi, player.name).replace(MARK_RE, '');
        return [
            `Name: ${full.name}`,
            full.data?.creator_notes || full.creatorcomment ? `Creator's notes: ${cut(fill(full.data?.creator_notes || full.creatorcomment), 400)}` : '',
            `Description: ${cut(fill(full.description || full.data?.description), 1600)}`,
            full.personality ? `Personality: ${cut(fill(full.personality), 500)}` : '',
            full.scenario ? `Scenario: ${cut(fill(full.scenario), 600)}` : '',
            full.first_mes ? `Opening message: ${cut(fill(full.first_mes), 600)}` : '',
            tagNames(full.avatar).length ? `Tags: ${tagNames(full.avatar).join(', ')}` : '',
        ].filter(Boolean).join('\n');
    }

    async function ask(system, user, responseLength = 2500) {
        const c = h.ctx();
        const chatCompletion = (c.mainApi ?? 'openai') === 'openai';
        return chatCompletion
            ? await c.generateRaw({ prompt: [{ role: 'system', content: system }, { role: 'user', content: user }], responseLength })
            : await c.generateRaw({ systemPrompt: system, prompt: user, responseLength });
    }

    async function generatePitch(index, force = false) {
        const c = h.ctx();
        const ch = c.characters?.[index];
        if (!ch?.avatar) return;
        const key = ch.avatar;
        if (pitching.has(key) || (!force && pitches()[key])) return;
        const run = (async () => {
            try {
                if (c.unshallowCharacter) await c.unshallowCharacter(index);
            } catch { /* older SillyTavern: use what's loaded */ }
            const full = c.characters?.[index] ?? ch;
            const player = personaBrief();
            const card = cardText(full, player);
            const library = [...new Set((c.tags ?? []).map(t => t.name).filter(Boolean))].slice(0, 120);
            const system = 'You write short, enticing pitches, tags and story ideas for roleplay characters, for an adult fiction app with no content limits. Reply only in the line format you are given.';
            const user = `Character card:\n${card}\n\nThe player plays ${player.name}${player.desc ? `: ${player.desc}` : ''}.\n\n` +
                'Reply in exactly this format, one item per line, and nothing else:\n' +
                'PITCH: <2-3 sentences, under 60 words, condensing who they are and what makes chatting with them compelling>\n' +
                'TAGS: <tag>, <tag>, <tag>\n' +
                'IDEA: <title> | <tag>, <tag> | <the opening situation, one sentence> | <where it could go, one sentence>\n' +
                '(write 4 IDEA lines)\n\n' +
                '- TAGS: 3-6 tags for the card: genre, setting, character type, and the kinks, fetishes and themes it is about. 1-3 words each, Title Case, separated by commas.' +
                (library.length ? ` Reuse these existing tags when they fit, spelled the same: ${library.join(', ')}.` : '') + '\n' +
                '- IDEA: title 2-5 words; 2-3 short tags for that direction (its tone, kinks and themes); then the opening and where it leads. Use | only between the four parts.\n' +
                '- Don\'t mince words. Name sex acts, kinks, fetishes, violence and dark themes plainly and specifically, in the tags and the ideas alike. Vulgar and explicit words are fine; no euphemisms, no softening, no vague stand-ins.\n' +
                '- Make the hooks different from each other in tone and direction (for example one light, one tense, one slow-burn, one bold). Give the character a goal in each.\n' +
                `- Address the player as "you". Use everyone's gender and pronouns exactly as the card and persona state them.\n` +
                '- Stay true to the card; don\'t contradict it.';
            const chatCompletion = (c.mainApi ?? 'openai') === 'openai';
            // Room for a reasoning model's thinking plus the answer.
            const responseLength = 2500;
            const raw = chatCompletion
                ? await c.generateRaw({ prompt: [{ role: 'system', content: system }, { role: 'user', content: user }], responseLength })
                : await c.generateRaw({ systemPrompt: system, prompt: user, responseLength });
            const parsed = parsePitch(raw);
            if (!parsed) {
                console.warn('[UI Overhaul] story ideas answer:', raw);
                const start = String(raw ?? '').replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
                throw new Error(start
                    ? `The answer couldn't be read. It began: “${cut(start.replace(/\s+/g, ' '), 140)}”`
                    : 'The answer came back empty (it may have run out of length while thinking, or been refused).');
            }
            const entry = { ...parsed, at: Date.now() };
            await applyCardTags(key, entry, pitches()[key]);
            pitches()[key] = entry;
            h.save();
        })();
        pitching.set(key, run);
        if (profileFor === index) renderProfile();
        try {
            await run;
        } catch (err) {
            console.error('[UI Overhaul] story ideas failed', err);
            pitches()[key] = { ...(pitches()[key] ?? {}), error: String(err?.message ?? err) };
        } finally {
            pitching.delete(key);
            if (profileFor === index && els.menu.classList.contains('uix-open')) renderProfile();
        }
    }

    // Tag names safe to pass to SillyTavern's tag commands.
    function cleanTags(list, max) {
        const seen = new Set();
        return (Array.isArray(list) ? list : [])
            .map(t => String(t ?? '').replace(/[|{}"\\<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 32))
            .filter(t => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()))
            .slice(0, max);
    }

    // The card's tags go onto the character in SillyTavern. Tags the AI added
    // last time and didn't suggest again are taken off; tags you added
    // yourself are never touched.
    async function applyCardTags(avatar, entry, previous) {
        const c = h.ctx();
        const run = (cmd) => c.executeSlashCommandsWithOptions(cmd);
        const has = () => tagNames(avatar).map(t => t.toLowerCase());
        const want = (entry.tags ?? []).map(t => t.toLowerCase());
        for (const old of previous?.added ?? []) {
            if (!want.includes(old.toLowerCase()) && has().includes(old.toLowerCase())) {
                try { await run(`/tag-remove name=${JSON.stringify(avatar)} ${JSON.stringify(old)}`); } catch { /* keep going */ }
            }
        }
        const keptAdded = (previous?.added ?? []).filter(t => want.includes(t.toLowerCase()));
        const added = [...keptAdded];
        for (const tag of entry.tags ?? []) {
            if (has().includes(tag.toLowerCase())) continue;
            try {
                await run(`/tag-add name=${JSON.stringify(avatar)} ${JSON.stringify(tag)}`);
                added.push(tag);
            } catch (err) {
                console.warn('[UI Overhaul] could not add tag', tag, err);
            }
        }
        entry.added = added;
        state.dirty = true;
    }

    async function removeCardTag(avatar, tag) {
        try {
            await h.ctx().executeSlashCommandsWithOptions(`/tag-remove name=${JSON.stringify(avatar)} ${JSON.stringify(tag)}`);
        } catch (err) {
            console.warn('[UI Overhaul] could not remove tag', err);
        }
        const entry = pitches()[avatar];
        if (entry?.added) entry.added = entry.added.filter(t => t.toLowerCase() !== tag.toLowerCase());
        state.dirty = true;
        h.save();
        renderProfile();
    }

    // Reads the line format (PITCH / TAGS / IDEA lines). Tolerates bullets,
    // numbering, bold markers and missing parts; falls back to JSON.
    function parsePitch(raw) {
        const text = String(raw ?? '').replace(/<think>[\s\S]*?(<\/think>|$)/gi, '');
        const lines = text.split(/\r?\n/).map(l => l.replace(/^[\s>*#\-•\d.)]+/, '').replace(/\*\*/g, '').trim()).filter(Boolean);
        let pitch = '';
        let tags = [];
        const hooks = [];
        for (const line of lines) {
            const m = /^(PITCH|TAGS?|IDEA|HOOK)\s*\d*\s*[:：]\s*(.*)$/i.exec(line);
            if (!m) {
                // a pitch that wrapped onto a second line
                if (pitch && !tags.length && !hooks.length) pitch += ` ${line}`;
                continue;
            }
            const kind = m[1].toUpperCase();
            const body = m[2].trim();
            if (kind === 'PITCH') pitch = body;
            else if (kind.startsWith('TAG')) tags = body.split(/[,;]/);
            else {
                const parts = body.split('|').map(x => x.trim());
                let [title, tagPart, idea, leads] = parts;
                if (parts.length === 3) [title, idea, leads, tagPart] = [parts[0], parts[1], parts[2], ''];
                if (parts.length === 2) [title, idea, tagPart, leads] = [parts[0], parts[1], '', ''];
                hooks.push({
                    title: cut(title, 60),
                    idea: cut(idea, 300),
                    leads: cut(leads, 300),
                    tags: cleanTags(String(tagPart ?? '').split(/[,;]/), 3),
                });
            }
        }
        const fromLines = { pitch: cut(pitch, 600), tags: cleanTags(tags, 6), hooks: hooks.filter(x => x.title || x.idea).slice(0, 6) };
        if (fromLines.pitch || fromLines.hooks.length) return fromLines;
        return parseJson(text);
    }

    function parseJson(raw) {
        const t = String(raw ?? '').replace(/```(?:json)?/gi, '');
        const a = t.indexOf('{');
        const b = t.lastIndexOf('}');
        if (a < 0 || b <= a) return null;
        try {
            const j = JSON.parse(t.slice(a, b + 1));
            const hooks = (Array.isArray(j.hooks) ? j.hooks : [])
                .map(x => ({ title: cut(x?.title, 60), idea: cut(x?.idea, 300), leads: cut(x?.leads, 300), tags: cleanTags(x?.tags, 3) }))
                .filter(x => x.title || x.idea)
                .slice(0, 6);
            const pitch = cut(j.pitch, 600);
            return pitch || hooks.length ? { pitch, hooks, tags: cleanTags(j.tags, 6) } : null;
        } catch {
            return null;
        }
    }

    function profileSheet(index) {
        const ch = h.ctx().characters?.[index];
        if (!ch) return;
        accentSheetFor = null;
        profileFor = index;
        renderProfile();
        els.menu.classList.add('uix-open', 'uix-profile-open');
        guardBack();
        generatePitch(index);
    }

    function renderProfile() {
        const c = h.ctx();
        const index = profileFor;
        const ch = c.characters?.[index];
        if (!ch) return;
        const s = settings();
        const e = { type: 'char', id: index, avatar: ch.avatar };
        const likes = h.likeCount(ch.avatar);
        const saved = pitches()[ch.avatar];
        const busy = pitching.has(ch.avatar);
        const tags = tagNames(ch.avatar);
        let ideas;
        if (busy) {
            ideas = '<div class="uix-pitch-wait"><i class="fa-solid fa-feather-pointed"></i> Writing story ideas…</div>';
        } else if (saved?.pitch || saved?.hooks?.length) {
            ideas = `
                ${saved.pitch ? `<p class="uix-pitch">${esc(saved.pitch)}</p>` : ''}
                ${(saved.hooks ?? []).map((k, i) => `
                    <div class="uix-hook">
                        <b>${esc(k.title)}</b>
                        ${k.tags?.length ? `<div class="uix-hook-tags">${k.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
                        ${k.idea ? `<p>${esc(k.idea)}</p>` : ''}
                        ${k.leads ? `<p class="uix-leads"><i class="fa-solid fa-route"></i> ${esc(k.leads)}</p>` : ''}
                        ${(() => {
                            const key = hookKey(k);
                            const busyHook = writing.has(key);
                            const ready = saved.openings?.[key] && greetingsOf(ch).includes(saved.openings[key]);
                            return `<div class="uix-hook-actions">
                                <button type="button" class="uix-play" data-hook="${i}"${busyHook ? ' disabled' : ''}>${busyHook
                                    ? '<i class="fa-solid fa-feather-pointed uix-writing"></i> Writing opening…'
                                    : '<i class="fa-solid fa-play"></i> Play this'}</button>
                                ${ready && !busyHook ? `<span class="uix-ready"><i class="fa-solid fa-wand-magic-sparkles"></i> Opening saved</span>
                                    <button type="button" class="uix-rewrite" data-rewrite="${i}" title="Write a new opening for this idea"><i class="fa-solid fa-rotate"></i></button>` : ''}
                            </div>${k.error ? `<p class="uix-pitch-err">${esc(k.error)}</p>` : ''}`;
                        })()}
                    </div>`).join('')}
                ${saved.error ? `<p class="uix-pitch-err">The last retry failed: ${esc(saved.error)}</p>` : ''}`;
        } else if (saved?.error) {
            ideas = `<p class="uix-pitch-err">Couldn't write ideas: ${esc(saved.error)} Check that you're connected, then retry.</p>`;
        } else {
            ideas = '<p class="uix-pitch-err">No ideas yet.</p>';
        }
        const panel = $('.uix-menu-panel', els.menu);
        panel.innerHTML = `
            <div class="uix-grab"></div>
            <div class="uix-prof-head">
                ${portrait(e, 'uix-prof-pic')}
                <div class="uix-prof-info">
                    <b>${esc(ch.name)}</b>
                    ${ch.date_last_chat ? `<small>Last played ${esc(ago(Number(ch.date_last_chat)))}</small>` : '<small>Not played yet</small>'}
                    ${tags.length ? `<div class="uix-prof-tags">${tags.map(t => {
                        const mine = (saved?.added ?? []).some(a => a.toLowerCase() === t.toLowerCase());
                        return mine
                            ? `<span class="uix-ai-tag" title="Added from story ideas">#${esc(t)}<button type="button" data-untag="${esc(t)}" title="Remove this tag">×</button></span>`
                            : `<span>#${esc(t)}</span>`;
                    }).join('')}</div>` : ''}
                    <div class="uix-prof-actions">
                        <button type="button" class="uix-prof-chat" data-open="char:${index}"><i class="fa-solid fa-comment"></i> Chat</button>
                        <button type="button" class="uix-barlike${likes ? ' uix-liked' : ''}" data-like="${esc(ch.avatar)}">${esc(s.likeIcon)}${likes ? ` <b>${likes}</b>` : ''}</button>
                        <button type="button" class="uix-icon" data-act="card" title="Edit card"><i class="fa-solid fa-pen"></i></button>
                    </div>
                </div>
            </div>
            ${h.accents ? `<button type="button" class="uix-accent-row" data-accentfor="card:${esc(ch.avatar)}" data-accentname="${esc(ch.name)}" data-accentindex="${index}">
                <i class="fa-solid fa-language"></i><span>Accent</span><b>${esc(h.accents.describe(h.accents.get(h.accents.keyForCard(ch.avatar))))}</b><i class="fa-solid fa-chevron-right"></i>
            </button>` : ''}
            <div class="uix-ideas-head">
                <h3>Story ideas</h3>
                ${saved?.at && !busy ? `<small>${esc(ago(saved.at))}</small>` : ''}
                <button type="button" class="uix-retry" data-act="retry"${busy ? ' disabled' : ''}><i class="fa-solid fa-rotate"></i> Retry</button>
            </div>
            ${ideas}`;
    }

    // ---------- Play this: an AI-written opening ----------
    // Playing an idea writes a custom first message for it, adds it to the
    // card's alternate greetings (so it stays in the list of starting
    // messages), starts a new chat and shows that greeting. AI-written
    // openings carry an invisible marker so they can be outlined in chat.

    const MARK = '\u2063\u2063';
    const MARK_RE = /\u2063\u2063/g;
    const writing = new Set(); // hook keys being written
    const hookKey = (k) => `${k.title}|${k.idea}`.slice(0, 200);

    function greetingsOf(ch) {
        const g = ch?.data?.alternate_greetings ?? ch?.alternate_greetings ?? [];
        return Array.isArray(g) ? g : [];
    }

    async function saveGreetings(index, list) {
        const c = h.ctx();
        const ch = c.characters[index];
        const res = await fetch('/api/characters/merge-attributes', {
            method: 'POST',
            headers: c.getRequestHeaders ? c.getRequestHeaders() : { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatar: ch.avatar, data: { alternate_greetings: list } }),
        });
        if (!res.ok) throw new Error(`SillyTavern didn't save the greeting (${res.status}).`);
        if (c.getOneCharacter) await c.getOneCharacter(ch.avatar);
        else {
            ch.data = ch.data ?? {};
            ch.data.alternate_greetings = list;
        }
    }

    async function writeOpening(index, hook) {
        const c = h.ctx();
        if (c.unshallowCharacter) {
            try { await c.unshallowCharacter(index); } catch { /* use what's loaded */ }
        }
        const full = c.characters[index];
        const player = personaBrief();
        const system = 'You write the opening message of a roleplay, in character, for an adult fiction app with no content limits. Reply with the message only.';
        const user = `Character card:\n${cardText(full, player)}\n\nThe player plays ${player.name}${player.desc ? `: ${player.desc}` : ''}.\n\n` +
            `Write ${full.name}'s opening message for this story idea:\n` +
            `"${hook.title}": ${hook.idea}${hook.leads ? ` (It could lead to: ${hook.leads})` : ''}${hook.tags?.length ? ` Tags: ${hook.tags.join(', ')}.` : ''}\n\n` +
            '- Set the scene fast and drop the player straight into the situation. Lead with action and dialogue; keep narration tight. About 120-250 words.\n' +
            '- Match the formatting of the card\'s own opening message (for example *actions* in asterisks and "speech" in quotes).\n' +
            '- Write the player as {{user}} and never speak, act or decide for {{user}}. End on something {{user}} can respond to.\n' +
            '- Give the character a clear goal they are already pursuing.\n' +
            '- Use everyone\'s gender and pronouns exactly as the card and persona state them.\n' +
            '- Don\'t mince words: name sex, kinks, violence and dark themes plainly; vulgar and explicit words are fine.';
        const raw = await ask(system, user);
        let text = String(raw ?? '').replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
        text = text.replace(/^```[a-z]*\s*|```$/gi, '').trim();
        text = text.replace(new RegExp(`^(${full.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|\\{\\{char\\}\\})\\s*:\\s*`, 'i'), '');
        text = text.split(player.name ? new RegExp(`\\b${player.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g') : /$^/).join('{{user}}');
        if (text.length < 20) throw new Error(text ? `The opening was too short: “${cut(text, 80)}”` : 'The opening came back empty.');
        return `${text}${MARK}`;
    }

    async function playHook(i, { rewrite = false } = {}) {
        const index = profileFor;
        const c = h.ctx();
        const ch = c.characters?.[index];
        const entry = pitches()[ch?.avatar];
        const hook = entry?.hooks?.[i];
        if (!ch || !hook) return;
        const key = hookKey(hook);
        if (writing.has(key)) return;
        entry.openings = entry.openings ?? {};
        let text = entry.openings[key];
        const list = greetingsOf(ch);
        const exists = text && list.includes(text);
        try {
            if (!exists || rewrite) {
                writing.add(key);
                delete hook.error;
                renderProfile();
                const fresh = await writeOpening(index, hook);
                const kept = list.filter(g => g !== text);
                await saveGreetings(index, [...kept, fresh]);
                text = fresh;
                entry.openings[key] = text;
                h.save();
            }
        } catch (err) {
            console.error('[UI Overhaul] opening failed', err);
            hook.error = String(err?.message ?? err);
            writing.delete(key);
            if (profileFor === index) renderProfile();
            return;
        }
        writing.delete(key);
        if (rewrite) {
            if (profileFor === index) renderProfile();
            return;
        }
        closeMenu();
        await open(`char:${index}`);
        await startWithGreeting(index, text);
    }

    // New chat with this character, then show the chosen greeting.
    async function startWithGreeting(index, text) {
        const c = h.ctx();
        try {
            await c.executeSlashCommandsWithOptions('/newchat');
        } catch (err) {
            console.error('[UI Overhaul] new chat failed', err);
            return;
        }
        const first = h.ctx().chat?.[0];
        if (!first?.swipes?.length) return;
        const alt = greetingsOf(h.ctx().characters[index]);
        let target = alt.indexOf(text) + 1;
        if (target <= 0 || !String(first.swipes[target] ?? '').includes(MARK)) {
            // find it by its marker and opening words
            const head = text.replace(MARK_RE, '').replace(/\{\{user\}\}/g, '').slice(0, 30);
            target = first.swipes.findIndex(sw => String(sw).includes(MARK) && String(sw).includes(head.slice(0, 20)));
        }
        if (target <= 0 || target === first.swipe_id) return;
        try {
            await c.swipe.to(null, 'left', { source: 'swipe_picker', forceMesId: 0, forceSwipeId: target, message: first });
        } catch (err) {
            console.warn('[UI Overhaul] could not pick the greeting', err);
        }
    }

    // ---------- accents ----------

    let accentSheetFor = null; // { key, name, index, back }
    const accentStates = {};

    function accentSheet(spec) {
        accentSheetFor = spec;
        const panel = $('.uix-menu-panel', els.menu);
        panel.innerHTML = `<div class="uix-grab"></div>
            <div class="uix-acc-head">
                ${spec.back !== undefined ? `<button type="button" class="uix-icon" data-act="accent-back"><i class="fa-solid fa-chevron-left"></i></button>` : ''}
                <b class="uix-menu-title">${esc(spec.name)}'s accent</b>
            </div>
            ${h.accents.editorHtml(spec.key, spec.name, { ...(accentStates[spec.key] ?? {}), index: spec.index })}`;
        els.menu.classList.add('uix-open');
        guardBack();
    }

    function bindAccents() {
        if (!h.accents || els.accentsBound) return;
        els.accentsBound = true;
        h.accents.bind(els.menu, () => {
            if (accentSheetFor && els.menu.classList.contains('uix-open')) accentSheet(accentSheetFor);
        }, (key) => (accentStates[key] ??= {}));
    }

    // ---------- cast board ----------
    // Everyone met in the current chat who isn't a card yet: characters
    // introduced with the teal character card (invented on the spot through
    // OOC) and named speakers who keep coming back. Any of them can become a
    // real character card, written by the AI from what the chat shows.

    const making = new Set(); // names being written
    const castErrors = {};

    function chatKey() {
        const c = h.ctx();
        return String(c.getCurrentChatId?.() ?? `${c.characterId ?? c.groupId}`);
    }

    function castMade() {
        const s = settings();
        if (!s.castMade || typeof s.castMade !== 'object') s.castMade = {};
        return (s.castMade[chatKey()] ??= {});
    }

    function plain(html) {
        return String(html ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
    }

    function scanCast() {
        const c = h.ctx();
        const chat = c.chat ?? [];
        const known = new Set([c.name1, c.name2, ...(c.characters ?? []).map(x => x?.name)].filter(Boolean).map(n => n.toLowerCase()));
        const found = new Map();
        chat.forEach((msg, id) => {
            if (!msg || msg.is_user || msg.is_system) return;
            const text = String(msg.mes ?? '');
            // Teal introduction cards from the preset's OOC rule.
            for (const m of text.matchAll(/<div[^>]*#4fb3a5[^>]*>([\s\S]*?)<\/div>/gi)) {
                const inner = m[1];
                const name = plain(/<b>([\s\S]*?)<\/b>/i.exec(inner)?.[1] ?? '').split('\n')[0].trim();
                if (!name || name.length > 40) continue;
                const field = (label) => plain(new RegExp(`${label}\\s*:\\s*([\\s\\S]*?)(?:<br|$)`, 'i').exec(inner)?.[1] ?? '');
                const entry = found.get(name.toLowerCase()) ?? { name, first: id, lines: 0, carded: true };
                Object.assign(entry, { looks: field('Looks'), personality: field('Personality'), wants: field('Wants'), accent: field('Accent'), carded: true });
                found.set(name.toLowerCase(), entry);
            }
            // Bold name tags (**Name:**) of characters a card voices.
            for (const m of text.matchAll(/(?:^|\n)\s*(?:\*\*|<strong>)([^*<\n:]{2,30}?)(?::(?:\*\*|<\/strong>)|(?:\*\*|<\/strong>)\s*:)/g)) {
                const name = m[1].trim();
                if (!name || name.startsWith('@')) continue;
                const key = name.toLowerCase();
                const entry = found.get(key) ?? { name, first: id, lines: 0, carded: false };
                entry.lines += 1;
                found.set(key, entry);
            }
        });
        return [...found.values()]
            .filter(e => !known.has(e.name.toLowerCase()) || castMade()[e.name])
            .filter(e => e.carded || e.lines >= 2)
            .sort((a, b) => a.first - b.first);
    }

    function castSheet() {
        accentSheetFor = null;
        profileFor = null;
        const list = scanCast();
        const made = castMade();
        const panel = $('.uix-menu-panel', els.menu);
        const c = h.ctx();
        panel.innerHTML = `<div class="uix-grab"></div><b class="uix-menu-title">Cast board</b>
            <p class="uix-cast-hint">Everyone met in this chat. Turn anyone into a character card of their own.</p>
            ${list.length ? list.map(e => {
                const avatar = made[e.name];
                const index = avatar ? (c.characters ?? []).findIndex(x => x?.avatar === avatar) : -1;
                const busy = making.has(e.name);
                return `<div class="uix-cast">
                    <div class="uix-cast-top"><b>${esc(e.name)}</b>${e.carded ? '<span class="uix-cast-new">invented</span>' : `<small>${e.lines} lines</small>`}</div>
                    ${e.looks ? `<p><i>Looks</i> ${esc(e.looks)}</p>` : ''}
                    ${e.personality ? `<p><i>Personality</i> ${esc(e.personality)}</p>` : ''}
                    ${e.wants ? `<p><i>Wants</i> ${esc(e.wants)}</p>` : ''}
                    ${h.accents ? (() => {
                        const key = h.accents.keyForName(e.name);
                        if (e.accent && !/^(none|-|n\/a)$/i.test(e.accent) && !h.accents.get(key)) {
                            const strength = /thick|heavy|strong|broad/i.test(e.accent) ? 3 : /slight|light|faint|hint|mild|subtle/i.test(e.accent) ? 1 : 2;
                            const accName = e.accent.replace(/\b(thick|heavy|strong|broad|slight|light|faint|mild|subtle)\b\s*/gi, '').trim() || e.accent;
                            h.accents.set(key, { id: 'custom', strength, displayName: e.name, custom: { name: accName } });
                        }
                        return `<button type="button" class="uix-accent-row uix-accent-small" data-accentfor="${esc(key)}" data-accentname="${esc(e.name)}">
                            <i class="fa-solid fa-language"></i><span>Accent</span><b>${esc(h.accents.describe(h.accents.get(key)))}</b><i class="fa-solid fa-chevron-right"></i></button>`;
                    })() : ''}
                    <div class="uix-hook-actions">
                        ${index >= 0
                            ? `<button type="button" class="uix-play" data-profile="${index}"><i class="fa-solid fa-id-card"></i> Open card</button>`
                            : `<button type="button" class="uix-play" data-mkcard="${esc(e.name)}"${busy ? ' disabled' : ''}>${busy
                                ? '<i class="fa-solid fa-feather-pointed uix-writing"></i> Writing card…'
                                : '<i class="fa-solid fa-user-plus"></i> Make a card'}</button>`}
                        <button type="button" class="uix-retry" data-jump="${e.first}"><i class="fa-solid fa-arrow-up"></i> First seen</button>
                    </div>
                    ${castErrors[e.name] ? `<p class="uix-pitch-err">${esc(castErrors[e.name])}</p>` : ''}
                </div>`;
            }).join('') : `<p class="uix-empty">Nobody new yet. Ask for a character out of character, like "(OOC: play the innkeeper)", and they'll appear here.</p>`}`;
        els.menu.classList.add('uix-open');
        guardBack();
    }

    function parseSections(text) {
        const out = {};
        let key = null;
        for (const line of String(text).split(/\r?\n/)) {
            const m = /^\s*(?:#{1,4}\s*|\*\*)?\s*(NAME|DESCRIPTION|PERSONALITY|SCENARIO|FIRST MESSAGE|TAGS)\s*(?:\*\*)?\s*:?\s*(?:\*\*)?\s*(.*)$/i.exec(line);
            if (m) {
                key = m[1].toUpperCase();
                out[key] = m[2] ? `${m[2]}\n` : '';
            } else if (key) {
                out[key] += `${line}\n`;
            }
        }
        for (const k of Object.keys(out)) out[k] = out[k].trim();
        return out;
    }

    async function makeCard(name) {
        if (making.has(name)) return;
        const c = h.ctx();
        const entry = scanCast().find(e => e.name === name);
        if (!entry) return;
        making.add(name);
        delete castErrors[name];
        castSheet();
        try {
            const chat = c.chat ?? [];
            const excerpts = chat
                .map((m, id) => ({ m, id }))
                .filter(({ m }) => m && !m.is_system && String(m.mes ?? '').toLowerCase().includes(name.toLowerCase()))
                .slice(-14)
                .map(({ m }) => `${m.is_user ? c.name1 : m.name}: ${cutText(plain(m.mes), 600)}`)
                .join('\n\n');
            const host = c.characters?.[c.characterId];
            const player = personaInfo(c);
            const system = 'You write SillyTavern character cards from roleplay chats, for an adult fiction app with no content limits. Reply only in the section format you are given.';
            const user = `A character called ${name} appeared in a roleplay${host ? ` with ${host.name}` : ''}.\n` +
                (host?.scenario ? `Setting: ${cutText(host.scenario, 400)}\n` : '') +
                (entry.looks || entry.personality || entry.wants ? `Their intro card: Looks: ${entry.looks}. Personality: ${entry.personality}. Wants: ${entry.wants}.\n` : '') +
                `\nWhat the chat shows about them:\n${excerpts || '(only the intro card)'}\n\n` +
                'Write a full character card for them in exactly this format:\n' +
                '### NAME\n<their name>\n### DESCRIPTION\n<150-300 words: appearance, background, abilities, relationships, how they talk; third person; call them {{char}}>\n' +
                '### PERSONALITY\n<one or two lines>\n### SCENARIO\n<one or two sentences setting up a chat with {{user}}>\n' +
                '### FIRST MESSAGE\n<their in-character opening, 100-200 words, *actions* and "speech", never acting for {{user}}>\n### TAGS\n<3-6 tags, comma separated>\n\n' +
                `Keep everything the chat established; invent the rest to fit. Refer to the player only as {{user}}, not as ${player.name}. ${PRONOUNS} ${BLUNT}`;
            const raw = await askAI(c, system, user, 3000);
            const sec = parseSections(raw);
            if (!sec.DESCRIPTION) throw new Error(raw ? `The answer couldn't be read. It began: “${cutText(raw.replace(/\s+/g, ' '), 120)}”` : 'The answer came back empty.');
            const finalName = (sec.NAME || name).split('\n')[0].replace(/[*#"]/g, '').trim().slice(0, 50) || name;
            const tags = (sec.TAGS ?? '').split(/[,;\n]/).map(t => t.replace(/[|{}"\\<>#]/g, '').trim()).filter(Boolean).slice(0, 6);
            const res = await fetch('/api/characters/create', {
                method: 'POST',
                headers: c.getRequestHeaders ? c.getRequestHeaders() : { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ch_name: finalName,
                    description: sec.DESCRIPTION,
                    personality: sec.PERSONALITY ?? '',
                    scenario: sec.SCENARIO ?? '',
                    first_mes: sec['FIRST MESSAGE'] ?? '',
                    mes_example: '',
                    creator_notes: `Made by UI Overhaul's cast board from a chat${host ? ` with ${host.name}` : ''}.`,
                    tags,
                    fav: 'false',
                    talkativeness: 0.5,
                }),
            });
            if (!res.ok) throw new Error(`SillyTavern didn't create the card (${res.status}).`);
            const avatar = (await res.text()).trim();
            if (c.getCharacters) await c.getCharacters();
            for (const tag of tags) {
                try { await c.executeSlashCommandsWithOptions(`/tag-add name=${JSON.stringify(avatar)} ${JSON.stringify(tag)}`); } catch { /* keep going */ }
            }
            castMade()[name] = avatar;
            const nameAccent = h.accents?.get(h.accents.keyForName(name));
            if (nameAccent) h.accents.set(h.accents.keyForCard(avatar), { ...nameAccent, displayName: undefined });
            h.save();
            state.dirty = true;
        } catch (err) {
            console.error('[UI Overhaul] making a card failed', err);
            castErrors[name] = String(err?.message ?? err);
        } finally {
            making.delete(name);
            if (els.menu.classList.contains('uix-open') && $('.uix-menu-title', els.menu)?.textContent === 'Cast board') castSheet();
        }
    }

    // ---------- input handling ----------

    async function onClick(event) {
        const t = event.target.closest('[data-act], [data-open], [data-like], [data-sort], [data-tag], [data-drawer], [data-persona], [data-profile], [data-hook], [data-untag], [data-rewrite], [data-mkcard], [data-jump], [data-accentfor]');
        if (!t) return;
        if (t.dataset.like) {
            event.stopPropagation();
            h.like(t.dataset.like);
            t.classList.remove('uio-pop');
            void t.offsetWidth;
            t.classList.add('uio-pop');
            return;
        }
        if (t.dataset.accentfor !== undefined) {
            const back = profileFor ?? (t.closest('.uix-cast') ? 'cast' : undefined);
            return accentSheet({
                key: t.dataset.accentfor,
                name: t.dataset.accentname,
                index: t.dataset.accentindex !== undefined ? Number(t.dataset.accentindex) : undefined,
                back,
            });
        }
        if (t.dataset.mkcard !== undefined) return makeCard(t.dataset.mkcard);
        if (t.dataset.jump !== undefined) {
            closeMenu();
            return document.querySelector(`#chat .mes[mesid="${CSS.escape(t.dataset.jump)}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
        if (t.dataset.untag !== undefined) {
            const avatar = h.ctx().characters?.[profileFor]?.avatar;
            return avatar && removeCardTag(avatar, t.dataset.untag);
        }
        if (t.dataset.profile !== undefined) return profileSheet(Number(t.dataset.profile));
        if (t.dataset.hook !== undefined) return playHook(Number(t.dataset.hook));
        if (t.dataset.rewrite !== undefined) return playHook(Number(t.dataset.rewrite), { rewrite: true });
        if (t.dataset.open) {
            closeMenu();
            return open(t.dataset.open);
        }
        if (t.dataset.sort) {
            settings().stageSort = t.dataset.sort;
            h.save();
            return renderHome();
        }
        if (t.dataset.tag) {
            state.tag = state.tag === t.dataset.tag ? null : t.dataset.tag;
            return renderHome();
        }
        if (t.dataset.drawer) return openDrawer(t.dataset.drawer);
        if (t.dataset.persona) return switchPersona(t.dataset.persona);

        const act = t.dataset.act;
        if (act.startsWith('m:')) {
            closeMenu();
            return clickId(`option_${act.slice(2)}`);
        }
        if (act.startsWith('n:')) {
            closeMenu();
            const which = act.slice(2);
            if (which === 'import') return clickId('character_import_button');
            if (which === 'url') return clickId('external_import_button');
            if (which === 'create') return openFromCharacterPanel('rm_button_create');
            if (which === 'group') return openFromCharacterPanel('rm_button_group_chats');
        }
        if (act.startsWith('drawer:')) {
            closeMenu();
            return openDrawer(act.slice(7));
        }
        switch (act) {
            case 'home': return show('home');
            case 'backstage':
                closeMenu();
                els.backstage.classList.add('uix-open');
                return guardBack();
            case 'close-backstage': return els.backstage.classList.remove('uix-open');
            case 'close-drawer': return toggleDrawer(els.sheetHead.dataset.drawer);
            case 'close-menu': return closeMenu();
            case 'actions': return actionsSheet();
            case 'new': return newSheet();
            case 'persona': return personaSheet();
            case 'card': closeMenu(); return openCard();
            case 'cast': return castSheet();
            case 'accent-back': {
                const back = accentSheetFor?.back;
                accentSheetFor = null;
                if (back === 'cast') return castSheet();
                if (typeof back === 'number') return profileSheet(back);
                return closeMenu();
            }
            case 'wrapped': return h.wrapped?.make();
            case 'who': {
                const who = current();
                if (who?.type === 'char') return profileSheet(Number(who.id));
                closeMenu();
                return openCard();
            }
            case 'retry': return generatePitch(profileFor, true);
            case 'effects': closeMenu(); return clickId('sfx-toggle');
            case 'closechat':
                closeMenu();
                clickId('option_close_chat');
                return show('home');
            case 'exit': {
                els.backstage.classList.remove('uix-open');
                settings().complete = false;
                h.save();
                h.reapply();
            }
        }
    }

    function insert(text, caretBack = 0) {
        const ta = document.getElementById('send_textarea');
        if (!ta) return;
        const start = ta.selectionStart ?? ta.value.length;
        const end = ta.selectionEnd ?? ta.value.length;
        ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
        const pos = start + text.length - caretBack;
        ta.focus();
        ta.setSelectionRange(pos, pos);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function onQuick(event) {
        const q = event.target.closest('[data-q]')?.dataset.q;
        if (!q) return;
        switch (q) {
            case 'reroll': return clickId('option_regenerate');
            case 'continue': return clickId('option_continue');
            case 'impersonate': return clickId('option_impersonate');
            case 'swipe': return document.querySelector('#chat .last_mes .swipe_right')?.click();
            case 'ooc': return insert('(OOC: )', 1);
            case 'text': return insert(`**@${h.ctx().name1 ?? 'me'}:** `);
        }
    }

    // ---------- the phone's back button ----------
    // Each step back closes the top layer: a sheet, an open menu, Backstage,
    // then the chat (back to home), instead of leaving the page.

    let sentinel = false;
    const menuOpen = () => els?.menu.classList.contains('uix-open');
    const backstageOpen = () => els?.backstage.classList.contains('uix-open');
    const sheetDrawer = () => (document.body.classList.contains('uix-sheet') ? els?.sheetHead.dataset.drawer : null);

    function layersOpen() {
        return state.on && (menuOpen() || !!sheetDrawer() || backstageOpen() || state.view === 'chat');
    }

    function guardBack() {
        if (!sentinel && layersOpen()) {
            history.pushState({ uix: true }, '');
            sentinel = true;
        }
    }

    window.addEventListener('popstate', () => {
        if (!sentinel) return;
        sentinel = false;
        if (!state.on) return;
        if (menuOpen()) closeMenu();
        else if (sheetDrawer()) toggleDrawer(sheetDrawer());
        else if (backstageOpen()) els.backstage.classList.remove('uix-open');
        else if (state.view === 'chat') show('home');
        setTimeout(guardBack, 50);
    });

    // ---------- public ----------

    return {
        profile(index) {
            if (!state.on) return;
            build();
            profileSheet(index);
        },
        enable() {
            build();
            state.on = true;
            document.body.classList.add('uix');
            placeQuick();
            show(hasChat() ? state.view : 'home');
        },
        disable() {
            state.on = false;
            if (!els) return;
            document.body.classList.remove('uix', 'uix-home', 'uix-sheet');
            els.backstage.classList.remove('uix-open');
            closeMenu();
            els.quick.remove();
        },
        // Something changed in SillyTavern (chat, cards, likes, effects).
        refresh(what) {
            if (!state.on || !els) return;
            if (what === 'effects') return renderEffects();
            if (profileFor !== null && els.menu.classList.contains('uix-open')) renderProfile();
            if (what === 'persona') {
                renderPersonaChip();
                if (state.view === 'home') renderHome();
                return;
            }
            if (what === 'chat') {
                placeQuick();
                renderBar();
                if (!hasChat() && state.view === 'chat') return show('home');
            }
            if (state.view === 'home') renderHome();
            else {
                renderBar();
                state.dirty = true;
            }
        },
        // Opening a chat from somewhere else (a classic list, a slash command)
        // goes straight to it.
        chatOpened() {
            if (!state.on || !els || !hasChat()) return;
            const drawer = els.sheetHead.dataset.drawer;
            if (document.body.classList.contains('uix-sheet') && drawer === 'rightNavHolder') {
                if (drawerOpen(drawer)) toggleDrawer(drawer);
                els.backstage.classList.remove('uix-open');
                show('chat');
            }
        },
    };
}
