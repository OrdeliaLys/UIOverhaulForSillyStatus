// Character generator and picture tools.
//
// Generate: a rough idea (plus optional tone and setting chips) becomes a full
// draft card written for how this setup plays: explicit pronouns, a goal,
// a voice (and accent), a short dialogue-led first message, tags that reuse
// your library. Every field is editable and can be rerolled on its own before
// the card is created.
//
// Pictures: the AI writes image-search queries from the card and opens them
// in Google Images, Pinterest or DuckDuckGo; "Set picture" uploads an image
// from the phone as the card's portrait (cropped to portrait shape).

import { ask, cut, personaInfo, BLUNT, PRONOUNS } from './ai.js';
import { ACCENTS, STRENGTH_NAMES } from './accents.js';

const TONES = ['Sweet', 'Teasing', 'Bratty', 'Dark', 'Chaotic', 'Wholesome', 'Dominant', 'Submissive', 'Yandere', 'Slow burn'];
const SETTINGS = ['Modern', 'Fantasy', 'Sci-fi', 'Historical', 'School', 'Supernatural', 'Post-apocalyptic', 'Office'];

const ENGINES = [
    { id: 'google', name: 'Google Images', icon: 'fa-brands fa-google', url: q => `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}` },
    { id: 'pinterest', name: 'Pinterest', icon: 'fa-brands fa-pinterest', url: q => `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}` },
    { id: 'ddg', name: 'DuckDuckGo', icon: 'fa-solid fa-magnifying-glass', url: q => `https://duckduckgo.com/?q=${encodeURIComponent(q)}&ia=images&iax=images` },
];

const FIELDS = [
    ['NAME', 'Name', 1],
    ['DESCRIPTION', 'Description', 9],
    ['PERSONALITY', 'Personality', 2],
    ['SCENARIO', 'Scenario', 2],
    ['FIRST MESSAGE', 'First message', 7],
    ['TAGS', 'Tags (comma separated)', 1],
];

export function createCreator(h) {
    // h: { ctx, settings, save, escapeHtml, accents, openProfile(index)?, refresh() }
    const esc = h.escapeHtml;
    let root = null;
    const st = { view: 'idea', idea: '', tones: new Set(), places: new Set(), draft: null, busy: '', error: '', avatar: null, queries: null };

    // ---------- shell ----------

    function ensure() {
        if (root) return root;
        root = document.createElement('div');
        root.id = 'uic-root';
        root.addEventListener('click', onClick);
        root.addEventListener('input', onInput);
        document.body.appendChild(root);
        return root;
    }

    function show() {
        ensure().classList.add('uic-open');
    }

    function close() {
        root?.classList.remove('uic-open');
    }

    function render() {
        ensure();
        const views = { idea: viewIdea, drafting: viewBusy, preview: viewPreview, done: viewDone, picture: viewPicture };
        root.innerHTML = `
            <header class="uic-top">
                <button type="button" class="uic-icon" data-c="close" title="Close"><i class="fa-solid fa-xmark"></i></button>
                <b>${st.view === 'picture' ? 'Picture' : 'New character'}</b>
                <span></span>
            </header>
            <div class="uic-body">${views[st.view]()}</div>`;
    }

    // ---------- views ----------

    const chips = (list, set, kind) => list.map(x => `<button type="button" class="uic-chip${set.has(x) ? ' uic-on' : ''}" data-chip="${kind}" data-v="${esc(x)}">${esc(x)}</button>`).join('');

    function viewIdea() {
        const p = personaInfo(h.ctx());
        return `
            <h1>Who should they be?</h1>
            <p class="uic-dim">A rough idea is enough. The AI fills in the rest, written for ${esc(p.name)}.</p>
            <textarea class="uic-idea" data-f="idea" rows="4" placeholder="e.g. a bratty fox-girl thief who thinks she owns you">${esc(st.idea)}</textarea>
            <h3>Tone</h3><div class="uic-chips">${chips(TONES, st.tones, 'tone')}</div>
            <h3>Setting</h3><div class="uic-chips">${chips(SETTINGS, st.places, 'place')}</div>
            ${st.error ? `<p class="uic-err">${esc(st.error)}</p>` : ''}
            <button type="button" class="uic-primary" data-c="generate"${st.idea.trim() ? '' : ' disabled'}><i class="fa-solid fa-wand-magic-sparkles"></i> Write the card</button>`;
    }

    function viewBusy() {
        return `<div class="uic-busy"><i class="fa-solid fa-feather-pointed"></i><h2>${esc(st.busy || 'Working…')}</h2><p class="uic-dim">This takes a little while with a thinking model.</p></div>`;
    }

    function viewPreview() {
        const d = st.draft;
        const acc = d.accent ?? { id: '', strength: 2 };
        return `
            <p class="uic-dim">Edit anything, or reroll one part. Nothing is saved until you create the card.</p>
            ${FIELDS.map(([k, label, rows]) => `
                <div class="uic-field">
                    <div class="uic-label"><span>${label}</span>
                        ${k !== 'NAME' ? `<button type="button" class="uic-reroll" data-reroll="${k}"${st.busy ? ' disabled' : ''} title="Rewrite this part">${st.busy === k ? '<i class="fa-solid fa-feather-pointed uic-writing"></i>' : '<i class="fa-solid fa-rotate"></i>'}</button>` : ''}
                    </div>
                    ${rows === 1
                        ? `<input class="uic-in" data-field="${k}" value="${esc(d[k] ?? '')}">`
                        : `<textarea class="uic-in" data-field="${k}" rows="${rows}">${esc(d[k] ?? '')}</textarea>`}
                </div>`).join('')}
            <div class="uic-field">
                <div class="uic-label"><span>Accent</span></div>
                <div class="uic-row">
                    <select class="uic-in" data-accent="id">
                        <option value="">None</option>
                        ${Object.entries(ACCENTS).filter(([k]) => k !== 'custom').map(([k, a]) => `<option value="${k}"${acc.id === k ? ' selected' : ''}>${a.flag} ${esc(a.name)}</option>`).join('')}
                        ${acc.id === 'custom' ? `<option value="custom" selected>✏️ ${esc(acc.custom?.name ?? 'Custom')}</option>` : ''}
                    </select>
                    <select class="uic-in" data-accent="strength">${[1, 2, 3].map(n => `<option value="${n}"${(acc.strength ?? 2) === n ? ' selected' : ''}>${STRENGTH_NAMES[n]}</option>`).join('')}</select>
                </div>
            </div>
            ${st.error ? `<p class="uic-err">${esc(st.error)}</p>` : ''}
            <div class="uic-actions">
                <button type="button" class="uic-ghost" data-c="restart"><i class="fa-solid fa-arrow-left"></i> Start over</button>
                <button type="button" class="uic-primary" data-c="create"${st.busy ? ' disabled' : ''}><i class="fa-solid fa-user-plus"></i> Create card</button>
            </div>`;
    }

    function viewDone() {
        const c = h.ctx();
        const ch = c.characters?.find(x => x?.avatar === st.avatar);
        return `
            <div class="uic-done">
                <div class="uic-portrait">${portrait(st.avatar)}</div>
                <h1>${esc(ch?.name ?? st.draft?.NAME ?? 'Done')}</h1>
                <p class="uic-dim">Created. Give them a face, then start playing.</p>
                <button type="button" class="uic-primary" data-c="picture"><i class="fa-solid fa-image"></i> Find a picture</button>
                <button type="button" class="uic-ghost" data-c="upload"><i class="fa-solid fa-upload"></i> Set picture from phone</button>
                <button type="button" class="uic-ghost" data-c="play"><i class="fa-solid fa-comment"></i> ${h.openProfile ? 'Open their profile' : 'Start chatting'}</button>
            </div>`;
    }

    function viewPicture() {
        const c = h.ctx();
        const ch = c.characters?.find(x => x?.avatar === st.avatar);
        const q = st.queries;
        return `
            <div class="uic-pic-head">
                <div class="uic-portrait uic-small">${portrait(st.avatar)}</div>
                <div><h2>${esc(ch?.name ?? '')}</h2><p class="uic-dim">Search ideas written from the card. Tap one to search; save an image you like, then set it here.</p></div>
            </div>
            ${st.busy ? viewBusy() : q?.length ? q.map((query, i) => `
                <div class="uic-query">
                    <b>${esc(query)}</b>
                    <div class="uic-engines">${ENGINES.map(e => `<button type="button" data-search="${i}" data-engine="${e.id}"><i class="${e.icon}"></i> ${e.name}</button>`).join('')}</div>
                </div>`).join('') : ''}
            ${st.error ? `<p class="uic-err">${esc(st.error)}</p>` : ''}
            <div class="uic-actions">
                <button type="button" class="uic-ghost" data-c="more"${st.busy ? ' disabled' : ''}><i class="fa-solid fa-rotate"></i> New ideas</button>
                <button type="button" class="uic-primary" data-c="upload"><i class="fa-solid fa-upload"></i> Set picture</button>
            </div>`;
    }

    function portrait(avatar) {
        if (!avatar) return '<i class="fa-solid fa-user"></i>';
        return `<img src="/characters/${encodeURIComponent(avatar)}?t=${st.bust ?? 0}" alt="" onerror="this.src='/thumbnail?type=avatar&file=${encodeURIComponent(avatar)}'">`;
    }

    // ---------- writing ----------

    function library() {
        return [...new Set((h.ctx().tags ?? []).map(t => t.name).filter(Boolean))].slice(0, 120);
    }

    const SECTIONS = '### NAME\n<first name, or first and last>\n' +
        '### DESCRIPTION\n<180-320 words in third person, calling them {{char}}. Start with a line "Pronouns: ..." stating their gender and pronouns plainly. Then appearance (body, face, hair, clothes), background, what they want right now and what they will do to get it, how they speak, and one flaw or contradiction.>\n' +
        '### PERSONALITY\n<one or two lines>\n' +
        '### SCENARIO\n<one or two sentences: where things stand when the chat opens, and how {{char}} knows {{user}}>\n' +
        '### FIRST MESSAGE\n<their opening, 120-220 words: *actions* in asterisks, "speech" in quotes, led by dialogue, dropping {{user}} into a situation, never speaking or acting for {{user}}, ending on something {{user}} can answer>\n' +
        '### TAGS\n<3-6 tags, comma separated>\n' +
        `### ACCENT\n<one of: ${Object.keys(ACCENTS).filter(k => k !== 'custom').join(', ')}; or none; or a short custom accent name. Then a space and 1, 2 or 3 for strength>\n` +
        '### SEARCH\n<3 short image-search queries (4-8 words each, one per line) that would find art matching their look: species or type, hair, eyes, outfit, mood, and an art style that fits the card (anime art, realistic, painting…)>';

    function parse(text) {
        const out = {};
        let key = null;
        for (const line of String(text).split(/\r?\n/)) {
            const m = /^\s*(?:#{1,4}\s*|\*\*)?\s*(NAME|DESCRIPTION|PERSONALITY|SCENARIO|FIRST MESSAGE|TAGS|ACCENT|SEARCH)\s*(?:\*\*)?\s*:?\s*(?:\*\*)?\s*(.*)$/i.exec(line);
            if (m && (/^\s*#/.test(line) || /^\s*\*\*/.test(line) || /^\s*[A-Z ]+:/.test(line))) {
                key = m[1].toUpperCase();
                out[key] = m[2] ? `${m[2]}\n` : '';
            } else if (key) {
                out[key] += `${line}\n`;
            }
        }
        for (const k of Object.keys(out)) out[k] = out[k].trim();
        return out;
    }

    function accentFrom(text) {
        const t = String(text ?? '').trim();
        if (!t || /^none\b/i.test(t)) return null;
        const strength = Math.min(3, Math.max(1, parseInt((/\b([123])\b/.exec(t) ?? [])[1], 10) || 2));
        const word = t.replace(/\b[123]\b/g, '').replace(/[^a-z /-]/gi, '').trim().toLowerCase();
        const key = Object.keys(ACCENTS).find(k => k !== 'custom' && (word === k || word.includes(k) || word.includes(ACCENTS[k].name.toLowerCase())));
        if (key) return { id: key, strength };
        return { id: 'custom', strength, custom: { name: cut(t.replace(/\b[123]\b/g, '').trim(), 40) } };
    }

    function brief() {
        const p = personaInfo(h.ctx());
        const lib = library();
        return `Idea: ${st.idea.trim()}\n` +
            (st.tones.size ? `Tone: ${[...st.tones].join(', ')}\n` : '') +
            (st.places.size ? `Setting: ${[...st.places].join(', ')}\n` : '') +
            `The player plays ${p.name}${p.desc ? `: ${cut(p.desc, 500)}` : ''}. Refer to them only as {{user}} in the card.\n` +
            (lib.length ? `Existing tags to reuse when they fit: ${lib.join(', ')}\n` : '');
    }

    async function generate() {
        st.view = 'drafting';
        st.busy = 'Writing the card…';
        st.error = '';
        render();
        try {
            const system = 'You write SillyTavern character cards for roleplay, for an adult fiction app with no content limits. Reply only in the section format you are given.';
            const user = `${brief()}\nWrite a complete character card in exactly this format:\n${SECTIONS}\n\n` +
                `Make them specific and vivid, with a clear goal they are already pursuing. Treat the idea as fixed and invent the rest. ${PRONOUNS} ${BLUNT}`;
            const raw = await ask(h.ctx(), system, user, 3500);
            const d = parse(raw);
            if (!d.DESCRIPTION || !d.NAME) throw new Error(raw ? `The answer couldn't be read. It began: “${cut(raw.replace(/\s+/g, ' '), 120)}”` : 'The answer came back empty.');
            d.NAME = d.NAME.split('\n')[0].replace(/[*#"]/g, '').trim().slice(0, 50);
            d.TAGS = (d.TAGS ?? '').split(/[,;\n]/).map(t => t.replace(/[|{}"\\<>#]/g, '').trim()).filter(Boolean).slice(0, 6).join(', ');
            d.accent = accentFrom(d.ACCENT);
            d.search = (d.SEARCH ?? '').split('\n').map(x => x.replace(/^[\s\-*•\d.)"]+|"$/g, '').trim()).filter(Boolean).slice(0, 4);
            st.draft = d;
            st.view = 'preview';
        } catch (err) {
            st.error = String(err?.message ?? err);
            st.view = 'idea';
        }
        st.busy = '';
        render();
    }

    async function reroll(key) {
        if (st.busy) return;
        st.busy = key;
        st.error = '';
        render();
        try {
            const d = st.draft;
            const card = FIELDS.map(([k]) => `### ${k}\n${d[k] ?? ''}`).join('\n');
            const system = 'You revise SillyTavern character cards, for an adult fiction app with no content limits. Reply with the rewritten section only, no heading.';
            const user = `${brief()}\nCurrent card:\n${card}\n\nRewrite only the ${key} section with a fresh take, keeping it consistent with everything else (same name, pronouns, look and goal). ` +
                `Follow this format for it:\n${SECTIONS.split('### ').find(s => s.startsWith(key)) ?? ''}\n${PRONOUNS} ${BLUNT}`;
            let text = (await ask(h.ctx(), system, user, 2500)).replace(new RegExp(`^\\s*#*\\s*${key}\\s*:?\\s*`, 'i'), '').trim();
            if (key === 'TAGS') text = text.split(/[,;\n]/).map(t => t.replace(/[|{}"\\<>#]/g, '').trim()).filter(Boolean).slice(0, 6).join(', ');
            if (text.length < 3) throw new Error('The rewrite came back empty.');
            d[key] = text;
        } catch (err) {
            st.error = String(err?.message ?? err);
        }
        st.busy = '';
        render();
    }

    async function create() {
        const c = h.ctx();
        const d = st.draft;
        if (!d.NAME?.trim()) {
            st.error = 'Give them a name first.';
            return render();
        }
        st.busy = 'Creating the card…';
        st.view = 'drafting';
        render();
        try {
            const tags = (d.TAGS ?? '').split(',').map(t => t.trim()).filter(Boolean);
            const res = await fetch('/api/characters/create', {
                method: 'POST',
                headers: c.getRequestHeaders ? c.getRequestHeaders() : { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ch_name: d.NAME.trim(),
                    description: d.DESCRIPTION ?? '',
                    personality: d.PERSONALITY ?? '',
                    scenario: d.SCENARIO ?? '',
                    first_mes: d['FIRST MESSAGE'] ?? '',
                    mes_example: '',
                    creator_notes: `Generated with UI Overhaul from the idea: ${st.idea.trim()}`,
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
            if (d.accent && h.accents) h.accents.set(h.accents.keyForCard(avatar), d.accent);
            if (d.search?.length) {
                const s = h.settings();
                (s.pictureQueries ??= {})[avatar] = d.search;
                h.save();
            }
            st.avatar = avatar;
            st.view = 'done';
            h.refresh?.();
        } catch (err) {
            st.error = String(err?.message ?? err);
            st.view = 'preview';
        }
        st.busy = '';
        render();
    }

    // ---------- pictures ----------

    async function writeQueries(avatar) {
        const c = h.ctx();
        const index = (c.characters ?? []).findIndex(x => x?.avatar === avatar);
        try { if (index >= 0 && c.unshallowCharacter) await c.unshallowCharacter(index); } catch { /* use what's loaded */ }
        const ch = c.characters?.[index];
        if (!ch) throw new Error('Character not found.');
        const system = 'You write image-search queries that find artwork matching a character. Reply with the queries only, one per line.';
        const user = `Character: ${ch.name}\n${cut(ch.description || ch.data?.description, 1500)}\n${(h.ctx().tagMap?.[avatar] ?? []).length ? '' : ''}\n` +
            'Write 4 short image-search queries (4-8 words each) that would find art of someone who looks like this: species or type, hair, eyes, outfit, mood, and an art style that fits (anime art, realistic, painting…). Vary them. No names, no quotes.';
        const raw = await ask(c, system, user, 1200);
        const list = raw.split('\n').map(x => x.replace(/^[\s\-*•\d.)"]+|"$/g, '').trim()).filter(x => x && x.length < 90).slice(0, 4);
        if (!list.length) throw new Error('No search ideas came back.');
        const s = h.settings();
        (s.pictureQueries ??= {})[avatar] = list;
        h.save();
        return list;
    }

    async function picture(avatar, fresh = false) {
        st.avatar = avatar;
        st.view = 'picture';
        st.error = '';
        st.queries = fresh ? null : h.settings().pictureQueries?.[avatar] ?? null;
        show();
        render();
        if (st.queries?.length) return;
        st.busy = 'Writing search ideas…';
        render();
        try {
            st.queries = await writeQueries(avatar);
        } catch (err) {
            st.error = String(err?.message ?? err);
        }
        st.busy = '';
        render();
    }

    // Crop to portrait (2:3), keeping the top of tall images, then upload.
    async function toPortrait(file) {
        const bmp = await createImageBitmap(file);
        const want = 2 / 3;
        let sw = bmp.width;
        let sh = bmp.height;
        let sx = 0;
        let sy = 0;
        if (sw / sh > want) {
            sw = Math.round(sh * want);
            sx = Math.round((bmp.width - sw) / 2);
        } else {
            sh = Math.round(sw / want);
            sy = Math.round((bmp.height - sh) * 0.15);
        }
        const scale = Math.min(1, 1200 / sh);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(sw * scale);
        canvas.height = Math.round(sh * scale);
        canvas.getContext('2d').drawImage(bmp, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        return new Promise(r => canvas.toBlob(r, 'image/png'));
    }

    function upload(avatar) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            if (!file) return;
            const c = h.ctx();
            st.busy = 'Setting the picture…';
            render();
            try {
                const blob = await toPortrait(file);
                const form = new FormData();
                form.append('avatar', blob, 'avatar.png');
                form.append('avatar_url', avatar);
                const headers = c.getRequestHeaders ? c.getRequestHeaders({ omitContentType: true }) : {};
                delete headers['Content-Type'];
                const res = await fetch('/api/characters/edit-avatar', { method: 'POST', headers, body: form });
                if (!res.ok) throw new Error((await res.text()) || `Upload failed (${res.status}).`);
                const thumb = `/thumbnail?type=avatar&file=${encodeURIComponent(avatar)}`;
                await fetch(thumb, { cache: 'reload' }).catch(() => {});
                await fetch(`/characters/${encodeURIComponent(avatar)}`, { cache: 'reload' }).catch(() => {});
                for (const img of document.querySelectorAll(`img[src^="${thumb}"]`)) {
                    const src = img.src;
                    img.src = '';
                    img.src = src;
                    if (img.srcset) {
                        const set = img.srcset;
                        img.srcset = '';
                        img.srcset = set;
                    }
                }
                st.bust = Date.now();
                h.refresh?.();
            } catch (err) {
                st.error = String(err?.message ?? err);
            }
            st.busy = '';
            render();
        });
        input.click();
    }

    // ---------- input ----------

    function onInput(e) {
        const t = e.target;
        if (t.dataset.f === 'idea') {
            st.idea = t.value;
            root.querySelector('[data-c="generate"]')?.toggleAttribute('disabled', !st.idea.trim());
        }
        if (t.dataset.field && st.draft) st.draft[t.dataset.field] = t.value;
        if (t.dataset.accent && st.draft) {
            const acc = st.draft.accent ?? { id: '', strength: 2 };
            if (t.dataset.accent === 'id') st.draft.accent = t.value ? { ...acc, id: t.value } : null;
            else if (st.draft.accent) st.draft.accent.strength = Number(t.value);
        }
    }

    function onClick(e) {
        const t = e.target.closest('[data-c], [data-chip], [data-reroll], [data-search]');
        if (!t) return;
        if (t.dataset.chip) {
            const set = t.dataset.chip === 'tone' ? st.tones : st.places;
            const v = t.dataset.v;
            set.has(v) ? set.delete(v) : set.add(v);
            t.classList.toggle('uic-on');
            return;
        }
        if (t.dataset.reroll) return reroll(t.dataset.reroll);
        if (t.dataset.search !== undefined) {
            const q = st.queries?.[Number(t.dataset.search)];
            const engine = ENGINES.find(x => x.id === t.dataset.engine);
            if (q && engine) window.open(engine.url(q), '_blank', 'noopener');
            return;
        }
        switch (t.dataset.c) {
            case 'close': return close();
            case 'generate': return generate();
            case 'restart':
                st.view = 'idea';
                st.error = '';
                return render();
            case 'create': return create();
            case 'picture': return picture(st.avatar);
            case 'more': return picture(st.avatar, true);
            case 'upload': return upload(st.avatar);
            case 'play': {
                const c = h.ctx();
                const index = (c.characters ?? []).findIndex(x => x?.avatar === st.avatar);
                close();
                if (index < 0) return;
                if (h.openProfile) return h.openProfile(index);
                return c.selectCharacterById?.(index, { switchMenu: false });
            }
        }
    }

    return {
        open() {
            st.view = 'idea';
            st.error = '';
            st.draft = null;
            st.avatar = null;
            show();
            render();
            setTimeout(() => root.querySelector('.uic-idea')?.focus(), 50);
        },
        picture: (avatar) => picture(avatar),
        upload: (avatar) => {
            st.avatar = avatar;
            st.view = 'picture';
            st.queries = h.settings().pictureQueries?.[avatar] ?? null;
            show();
            render();
            upload(avatar);
        },
        isOpen: () => !!root?.classList.contains('uic-open'),
        close,
    };
}
