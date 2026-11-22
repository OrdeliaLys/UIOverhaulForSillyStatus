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
                <section class="uix-liked"></section>
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
        const liked = all.filter(e => e.likes > 0).sort((a, b) => b.likes - a.likes).slice(0, 10);
        const likedEl = $('.uix-liked', els.home);
        likedEl.hidden = !liked.length;
        likedEl.innerHTML = liked.length ? `
            <h2>${esc(s.likeIcon)} ${esc(h.mostLabel())}</h2>
            <div class="uix-row">${liked.map(e => `
                <button type="button" class="uix-mini" data-open="${e.type}:${esc(e.id)}">
                    ${portrait(e, 'uix-mini-pic')}<span>${esc(e.name)}</span><small>${esc(s.likeIcon)} ${e.likes}</small>
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
        els.menu.classList.remove('uix-open', 'uix-profile-open');
        profileFor = null;
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
            const fill = (t) => String(t ?? '').replace(/\{\{char\}\}/gi, full.name).replace(/\{\{user\}\}/gi, player.name);
            const card = [
                `Name: ${full.name}`,
                full.data?.creator_notes || full.creatorcomment ? `Creator's notes: ${cut(fill(full.data?.creator_notes || full.creatorcomment), 400)}` : '',
                `Description: ${cut(fill(full.description || full.data?.description), 1600)}`,
                full.personality ? `Personality: ${cut(fill(full.personality), 500)}` : '',
                full.scenario ? `Scenario: ${cut(fill(full.scenario), 600)}` : '',
                full.first_mes ? `Opening message: ${cut(fill(full.first_mes), 600)}` : '',
                tagNames(full.avatar).length ? `Tags: ${tagNames(full.avatar).join(', ')}` : '',
            ].filter(Boolean).join('\n');
            const system = 'You write short, enticing pitches and story ideas for roleplay characters, for an adult fiction app. Reply with JSON only.';
            const user = `Character card:\n${card}\n\nThe player plays ${player.name}${player.desc ? `: ${player.desc}` : ''}.\n\n` +
                'Write JSON: {"pitch": "...", "hooks": [{"title": "...", "idea": "...", "leads": "..."}]}\n' +
                '- pitch: 2-3 sentences, under 60 words, condensing who they are and what makes chatting with them compelling.\n' +
                '- hooks: exactly 4 chat ideas. title: 2-5 words. idea: one sentence setting up the opening situation. leads: one sentence on where it could go.\n' +
                '- Make the hooks different from each other in tone and direction (for example one light, one tense, one slow-burn, one bold). Give the character a goal in each.\n' +
                `- Address the player as "you". Use everyone's gender and pronouns exactly as the card and persona state them.\n` +
                '- Stay true to the card; don\'t contradict it.';
            const chatCompletion = (c.mainApi ?? 'openai') === 'openai';
            const raw = chatCompletion
                ? await c.generateRaw({ prompt: [{ role: 'system', content: system }, { role: 'user', content: user }] })
                : await c.generateRaw({ systemPrompt: system, prompt: user });
            const parsed = parsePitch(raw);
            if (!parsed) throw new Error('The answer could not be read.');
            pitches()[key] = { ...parsed, at: Date.now() };
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

    function parsePitch(raw) {
        const t = String(raw ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '');
        const a = t.indexOf('{');
        const b = t.lastIndexOf('}');
        if (a < 0 || b <= a) return null;
        try {
            const j = JSON.parse(t.slice(a, b + 1));
            const hooks = (Array.isArray(j.hooks) ? j.hooks : [])
                .map(x => ({ title: cut(x?.title, 60), idea: cut(x?.idea, 300), leads: cut(x?.leads, 300) }))
                .filter(x => x.title || x.idea)
                .slice(0, 6);
            const pitch = cut(j.pitch, 600);
            return pitch || hooks.length ? { pitch, hooks } : null;
        } catch {
            return null;
        }
    }

    function profileSheet(index) {
        const ch = h.ctx().characters?.[index];
        if (!ch) return;
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
                        ${k.idea ? `<p>${esc(k.idea)}</p>` : ''}
                        ${k.leads ? `<p class="uix-leads"><i class="fa-solid fa-route"></i> ${esc(k.leads)}</p>` : ''}
                        <button type="button" class="uix-play" data-hook="${i}"><i class="fa-solid fa-play"></i> Play this</button>
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
                    ${tags.length ? `<div class="uix-prof-tags">${tags.slice(0, 6).map(t => `<span>#${esc(t)}</span>`).join('')}</div>` : ''}
                    <div class="uix-prof-actions">
                        <button type="button" class="uix-prof-chat" data-open="char:${index}"><i class="fa-solid fa-comment"></i> Chat</button>
                        <button type="button" class="uix-barlike${likes ? ' uix-liked' : ''}" data-like="${esc(ch.avatar)}">${esc(s.likeIcon)}${likes ? ` <b>${likes}</b>` : ''}</button>
                        <button type="button" class="uix-icon" data-act="card" title="Edit card"><i class="fa-solid fa-pen"></i></button>
                    </div>
                </div>
            </div>
            <div class="uix-ideas-head">
                <h3>Story ideas</h3>
                ${saved?.at && !busy ? `<small>${esc(ago(saved.at))}</small>` : ''}
                <button type="button" class="uix-retry" data-act="retry"${busy ? ' disabled' : ''}><i class="fa-solid fa-rotate"></i> Retry</button>
            </div>
            ${ideas}`;
    }

    // "Play this": opens the chat and drafts the idea as an out-of-character
    // note in the message box, ready to edit or send.
    async function playHook(i) {
        const index = profileFor;
        const ch = h.ctx().characters?.[index];
        const hook = pitches()[ch?.avatar]?.hooks?.[i];
        if (!ch || !hook) return;
        closeMenu();
        await open(`char:${index}`);
        const ta = document.getElementById('send_textarea');
        if (ta) ta.value = '';
        insert(`(OOC: Let's play this: ${hook.title}. ${hook.idea}${hook.leads ? ` It could lead to: ${hook.leads}` : ''})`);
    }

    // ---------- input handling ----------

    async function onClick(event) {
        const t = event.target.closest('[data-act], [data-open], [data-like], [data-sort], [data-tag], [data-drawer], [data-persona], [data-profile], [data-hook]');
        if (!t) return;
        if (t.dataset.like) {
            event.stopPropagation();
            h.like(t.dataset.like);
            t.classList.remove('uio-pop');
            void t.offsetWidth;
            t.classList.add('uio-pop');
            return;
        }
        if (t.dataset.profile !== undefined) return profileSheet(Number(t.dataset.profile));
        if (t.dataset.hook !== undefined) return playHook(Number(t.dataset.hook));
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
