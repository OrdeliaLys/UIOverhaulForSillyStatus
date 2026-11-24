// Like Wrapped: a laid-back, story-style recap of the cards you've liked.
//
// The numbers (totals, top cards, top tags, what changed since last time)
// are counted here, so they're always exact. The AI adds the fun part: a
// name for your taste, patterns, facts and what shifted since the last
// recap. Every recap is saved, and the next one compares itself to it.
// The look follows what likes are called: hearts, stars, fire and so on
// each get their own colours, and the icon itself floats through the slides.

import { ask, cut } from './ai.js';

const KEEP = 12; // recaps kept

// ---------- theme from the like's name and icon ----------

const THEMES = [
    { test: /fire|hot|spic|thirst|🔥|🌶/i, name: 'ember', a: '#ff6a3d', b: '#b3122e', c: '#2a0a10', glow: '#ffb347' },
    { test: /star|fav|⭐|🌟|✨|💫|kudo|shine/i, name: 'starlight', a: '#ffd25e', b: '#6b4bff', c: '#120d2e', glow: '#fff1b8' },
    { test: /skull|dead|💀|☠|cursed|doom/i, name: 'grave', a: '#b7f34d', b: '#3a3a52', c: '#0b0b10', glow: '#e8ffb0' },
    { test: /simp|drool|🤤|😍|🥵|horny|lewd/i, name: 'blush', a: '#ff5fa2', b: '#ff9a3c', c: '#2b0a1d', glow: '#ffd1e6' },
    { test: /clap|👏|👍|thumb|up|vote|rate/i, name: 'mint', a: '#3ee6b0', b: '#2a6cf0', c: '#071a1c', glow: '#b8fff0' },
    { test: /♥|❤|💖|💕|💗|💘|💜|💓|like|love|heart|crush|adore/i, name: 'heart', a: '#ff4f8b', b: '#8a3cff', c: '#1c0a24', glow: '#ffc2dc' },
];

export function wrappedTheme(label, icon) {
    const key = `${label} ${icon}`;
    const found = THEMES.find(t => t.test.test(key));
    if (found) return found;
    // Anything else: colours from the name itself, so every name looks its own.
    let hash = 0;
    for (const ch of key) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
    const hue = hash % 360;
    return {
        name: 'custom',
        a: `hsl(${hue} 90% 62%)`,
        b: `hsl(${(hue + 70) % 360} 75% 52%)`,
        c: `hsl(${hue} 45% 8%)`,
        glow: `hsl(${hue} 100% 85%)`,
    };
}

export function createWrapped(h) {
    // h: { ctx, settings, save, likeCount, mostLabel, tagNamesOf, escapeHtml, fullImageUrl }
    const esc = h.escapeHtml;
    let root = null;
    let slides = [];
    let at = 0;
    let busy = false;

    const s = () => h.settings();
    const recaps = () => (Array.isArray(s().recaps) ? s().recaps : (s().recaps = []));
    const noun = () => {
        const label = s().likeLabel.trim() || 'Like';
        return { one: label, many: /s$/i.test(label) ? label : `${label}s` };
    };

    function avatarImg(avatar, cls = '') {
        const src = `/thumbnail?type=avatar&file=${encodeURIComponent(avatar)}`;
        const full = s().sharp ? h.fullImageUrl(src) : null;
        return `<img class="${cls}" src="${esc(src)}"${full ? ` srcset="${esc(full)}"` : ''} alt="" decoding="async">`;
    }

    function nameOf(avatar) {
        return h.ctx().characters?.find(c => c?.avatar === avatar)?.name ?? s().likeNames?.[avatar] ?? String(avatar).replace(/\.png$/i, '');
    }

    // ---------- counting ----------

    function countNow() {
        const likes = s().likes ?? {};
        const top = Object.entries(likes)
            .filter(([, n]) => n > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([avatar, n]) => ({ avatar, name: nameOf(avatar), n, tags: h.tagNamesOf(avatar) }));
        const total = top.reduce((a, x) => a + x.n, 0);
        const tagScore = new Map();
        for (const x of top) for (const t of x.tags) tagScore.set(t, (tagScore.get(t) ?? 0) + x.n);
        const tags = [...tagScore.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
        return { total, cards: top.length, top, tags };
    }

    function compare(now, prev) {
        if (!prev) return null;
        const before = new Map((prev.top ?? []).map(x => [x.avatar, x.n]));
        const gained = now.top.map(x => ({ ...x, gain: x.n - (before.get(x.avatar) ?? 0) })).filter(x => x.gain > 0).sort((a, b) => b.gain - a.gain);
        const newcomers = now.top.filter(x => !before.has(x.avatar));
        const prevTop5 = (prev.top ?? []).slice(0, 5).map(x => x.avatar);
        const nowTop5 = now.top.slice(0, 5).map(x => x.avatar);
        const prevTags = new Set((prev.tags ?? []).slice(0, 5).map(([t]) => t));
        return {
            since: prev.at,
            added: now.total - (prev.total ?? 0),
            newCards: newcomers.length,
            climber: gained[0] ?? null,
            newcomers: newcomers.slice(0, 4),
            enteredTop5: nowTop5.filter(a => !prevTop5.includes(a)).map(nameOf),
            leftTop5: prevTop5.filter(a => !nowTop5.includes(a)).map(nameOf),
            newTags: now.tags.slice(0, 5).map(([t]) => t).filter(t => !prevTags.has(t)),
            prevTitle: prev.ai?.title ?? '',
        };
    }

    // ---------- the AI part ----------

    async function writeUp(now, diff, prev) {
        const c = h.ctx();
        const { one, many } = noun();
        const lines = now.top.slice(0, 25).map((x) => {
            const ch = c.characters?.find(k => k?.avatar === x.avatar);
            const about = cut(String(ch?.data?.creator_notes || ch?.creatorcomment || ch?.description || '').replace(/<[^>]+>/g, ' ').replace(/\{\{char\}\}/gi, x.name).replace(/\s+/g, ' '), 160);
            return `- ${x.name}: ${x.n} ${x.n === 1 ? one : many}${x.tags.length ? ` [${x.tags.join(', ')}]` : ''}${about ? ` — ${about}` : ''}`;
        }).join('\n');
        const system = 'You write a playful, laid-back "year in review" recap (like Spotify Wrapped) of someone\'s favourite roleplay characters, for an adult fiction app with no content limits. Reply only in the line format you are given.';
        const user = `On this app, liking a card is called "${one}" (icon ${s().likeIcon}); they hand out ${many} and a card can get many. Lean into that name: puns, the icon, its vibe.\n\n` +
            `Their cards, most ${many} first:\n${lines}\n\n` +
            `Totals: ${now.total} ${many} across ${now.cards} cards. Top tags by ${many}: ${now.tags.map(([t, n]) => `${t} (${n})`).join(', ') || 'none'}.\n` +
            (diff ? `\nLast recap (${new Date(diff.since).toDateString()}) called their taste "${diff.prevTitle}". Since then: +${diff.added} ${many}, ${diff.newCards} newly ${one.toLowerCase()}d cards` +
                `${diff.climber ? `, biggest climber ${diff.climber.name} (+${diff.climber.gain})` : ''}` +
                `${diff.enteredTop5.length ? `, new in the top 5: ${diff.enteredTop5.join(', ')}` : ''}` +
                `${diff.leftTop5.length ? `, dropped out of the top 5: ${diff.leftTop5.join(', ')}` : ''}` +
                `${diff.newTags.length ? `, rising tags: ${diff.newTags.join(', ')}` : ''}.\n` +
                (prev?.ai?.patterns?.length ? `Last time's patterns: ${prev.ai.patterns.join(' / ')}\n` : '') : '') +
            '\nWrite exactly this, one item per line, nothing else:\n' +
            'TITLE: <a fun 2-5 word name for their taste, like a music-genre persona>\n' +
            'TYPE: <one or two sentences describing that taste, warm and teasing>\n' +
            'PATTERN: <a pattern you notice across the cards> (write 3 PATTERN lines)\n' +
            'FACT: <a fun, specific fact or comparison drawn from the data> (write 2 FACT lines)\n' +
            (diff ? 'CHANGE: <what shifted since the last recap and what it says about them> (write 2 CHANGE lines)\n' : '') +
            'CLOSER: <a short, cheeky sign-off line>\n\n' +
            'Be specific: name characters and tags. Keep each line under 35 words. Talk to them as "you". ' +
            'Don\'t mince words: name kinks, fetishes and themes plainly; vulgar is fine.';
        const raw = await ask(c, system, user, 2500);
        const out = { title: '', type: '', patterns: [], facts: [], changes: [], closer: '' };
        for (const line of raw.split(/\r?\n/)) {
            const m = /^[\s>*#\-•\d.)]*\**\s*(TITLE|TYPE|PATTERN|FACT|CHANGE|CLOSER)\s*\d*\s*\**\s*[:：]\s*\**\s*(.+)$/i.exec(line);
            if (!m) continue;
            const v = cut(m[2].replace(/\*\*/g, '').trim(), 280);
            const k = m[1].toUpperCase();
            if (k === 'TITLE') out.title = v.replace(/^["“]|["”]$/g, '');
            else if (k === 'TYPE') out.type = v;
            else if (k === 'PATTERN') out.patterns.push(v);
            else if (k === 'FACT') out.facts.push(v);
            else if (k === 'CHANGE') out.changes.push(v);
            else if (k === 'CLOSER') out.closer = v;
        }
        if (!out.title && !out.patterns.length) {
            throw new Error(raw ? `The answer couldn't be read. It began: “${cut(raw.replace(/\s+/g, ' '), 120)}”` : 'The answer came back empty.');
        }
        return out;
    }

    // ---------- slides ----------

    function buildSlides(recap, diff) {
        const { one, many } = noun();
        const icon = esc(recap.icon ?? s().likeIcon);
        const most = esc(h.mostLabel());
        const st = recap.stats;
        const ai = recap.ai ?? {};
        const top = st.top[0];
        const share = top && st.total ? Math.round(100 * top.n / st.total) : 0;
        const out = [];

        out.push(`<div class="uiw-slide uiw-intro">
            <div class="uiw-kicker">${new Date(recap.at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</div>
            <div class="uiw-bigicon">${icon}</div>
            <h1>Your ${esc(one)}<br>Wrapped</h1>
            <p>${diff ? `Everything since ${new Date(diff.since).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, and how it's changed.` : 'Every card you\'ve ever ' + esc(one.toLowerCase()) + 'd, all in one place.'}</p>
            <small class="uiw-tap">Tap to continue</small>
        </div>`);

        out.push(`<div class="uiw-slide uiw-number">
            <p>You handed out</p>
            <div class="uiw-huge" data-count="${st.total}">${st.total}</div>
            <h2>${esc(st.total === 1 ? one : many)} ${icon}</h2>
            <p>across <b>${st.cards}</b> ${st.cards === 1 ? 'card' : 'cards'}${diff && diff.added > 0 ? `, <b>+${diff.added}</b> since last time` : ''}.</p>
        </div>`);

        if (top) {
            out.push(`<div class="uiw-slide uiw-topcard">
                <div class="uiw-kicker">Your number one</div>
                <div class="uiw-portrait">${avatarImg(top.avatar)}<span class="uiw-rank">#1</span></div>
                <h1>${esc(top.name)}</h1>
                <p><b>${top.n}</b> ${esc(top.n === 1 ? one : many)}. That's <b>${share}%</b> of all of them.</p>
                ${top.tags.length ? `<div class="uiw-tags">${top.tags.slice(0, 4).map(t => `<span>#${esc(t)}</span>`).join('')}</div>` : ''}
            </div>`);
        }

        if (st.top.length > 1) {
            const max = st.top[0].n || 1;
            out.push(`<div class="uiw-slide uiw-list">
                <div class="uiw-kicker">${most}</div>
                <h2>Your top ${Math.min(5, st.top.length)}</h2>
                <ol>${st.top.slice(0, 5).map((x, i) => `
                    <li style="--d:${i * 90}ms">
                        <span class="uiw-n">${i + 1}</span>${avatarImg(x.avatar)}
                        <span class="uiw-who"><b>${esc(x.name)}</b><i style="width:${Math.max(8, Math.round(100 * x.n / max))}%"></i></span>
                        <span class="uiw-c">${x.n}</span>
                    </li>`).join('')}</ol>
            </div>`);
        }

        if (st.tags.length) {
            const max = st.tags[0][1] || 1;
            out.push(`<div class="uiw-slide uiw-tagcloud">
                <div class="uiw-kicker">What you keep coming back to</div>
                <h2>Your top tags</h2>
                <div class="uiw-bubbles">${st.tags.map(([t, n], i) => `
                    <span style="--s:${(0.8 + 1.4 * n / max).toFixed(2)};--d:${i * 70}ms">#${esc(t)}<small>${n}</small></span>`).join('')}</div>
            </div>`);
        }

        if (ai.title) {
            out.push(`<div class="uiw-slide uiw-type">
                <div class="uiw-kicker">Your ${esc(one.toLowerCase())} personality</div>
                <h1 class="uiw-title">${esc(ai.title)}</h1>
                <p>${esc(ai.type)}</p>
                ${diff?.prevTitle && diff.prevTitle !== ai.title ? `<small class="uiw-was">Last time: ${esc(diff.prevTitle)}</small>` : ''}
            </div>`);
        }

        if (ai.patterns?.length) {
            out.push(`<div class="uiw-slide uiw-points">
                <div class="uiw-kicker">Patterns</div>
                <h2>We noticed…</h2>
                ${ai.patterns.map((p, i) => `<p class="uiw-point" style="--d:${i * 140}ms">${esc(p)}</p>`).join('')}
            </div>`);
        }

        if (ai.facts?.length) {
            out.push(`<div class="uiw-slide uiw-points">
                <div class="uiw-kicker">Fun facts</div>
                <h2>For the record</h2>
                ${ai.facts.map((p, i) => `<p class="uiw-point" style="--d:${i * 140}ms">${esc(p)}</p>`).join('')}
            </div>`);
        }

        if (diff) {
            const bits = [];
            if (diff.climber) bits.push(`<div class="uiw-stat"><b>+${diff.climber.gain}</b><span>Biggest climber: ${esc(diff.climber.name)}</span></div>`);
            if (diff.newcomers.length) bits.push(`<div class="uiw-stat"><b>${diff.newCards}</b><span>New ${diff.newCards === 1 ? 'face' : 'faces'}: ${esc(diff.newcomers.map(x => x.name).join(', '))}</span></div>`);
            if (diff.enteredTop5.length) bits.push(`<div class="uiw-stat"><b>↑</b><span>Into the top 5: ${esc(diff.enteredTop5.join(', '))}</span></div>`);
            if (diff.leftTop5.length) bits.push(`<div class="uiw-stat"><b>↓</b><span>Out of the top 5: ${esc(diff.leftTop5.join(', '))}</span></div>`);
            if (diff.newTags.length) bits.push(`<div class="uiw-stat"><b>#</b><span>Rising: ${esc(diff.newTags.map(t => `#${t}`).join(' '))}</span></div>`);
            out.push(`<div class="uiw-slide uiw-points">
                <div class="uiw-kicker">Since last time</div>
                <h2>What changed</h2>
                ${bits.join('') || '<p>Pretty much nothing. Loyal.</p>'}
                ${(ai.changes ?? []).map((p, i) => `<p class="uiw-point" style="--d:${i * 140}ms">${esc(p)}</p>`).join('')}
            </div>`);
        }

        out.push(`<div class="uiw-slide uiw-outro">
            <div class="uiw-bigicon">${icon}</div>
            <h1>${esc(ai.closer || `Keep the ${many.toLowerCase()} coming.`)}</h1>
            <p>This recap is saved. The next one will show what changed.</p>
            <div class="uiw-actions">
                <button type="button" data-w="copy"><i class="fa-solid fa-copy"></i> Copy summary</button>
                <button type="button" data-w="close" class="uiw-primary">Done</button>
            </div>
        </div>`);
        return out;
    }

    // ---------- the overlay ----------

    function ensureRoot() {
        if (root) return root;
        root = document.createElement('div');
        root.id = 'uiw-root';
        root.innerHTML = `
            <div class="uiw-bg"><i></i><i></i><i></i></div>
            <div class="uiw-float"></div>
            <div class="uiw-bars"></div>
            <button type="button" class="uiw-x" data-w="close" title="Close"><i class="fa-solid fa-xmark"></i></button>
            <div class="uiw-stage"></div>`;
        root.addEventListener('click', onClick);
        document.body.appendChild(root);
        document.addEventListener('keydown', (e) => {
            if (!root.classList.contains('uiw-open')) return;
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowRight') go(at + 1);
            if (e.key === 'ArrowLeft') go(at - 1);
        });
        return root;
    }

    function applyTheme(label, icon) {
        const t = wrappedTheme(label, icon);
        const r = ensureRoot();
        r.dataset.theme = t.name;
        r.style.setProperty('--w-a', t.a);
        r.style.setProperty('--w-b', t.b);
        r.style.setProperty('--w-c', t.c);
        r.style.setProperty('--w-glow', t.glow);
        // the like icon floats through every slide
        r.querySelector('.uiw-float').innerHTML = Array.from({ length: 14 }, (_, i) =>
            `<span style="left:${(i * 37) % 100}%;--t:${9 + (i * 7) % 9}s;--dl:-${(i * 13) % 11}s;--z:${0.6 + ((i * 5) % 7) / 6}">${esc(icon)}</span>`).join('');
    }

    function open() {
        const r = ensureRoot();
        r.classList.add('uiw-open');
        document.body.classList.add('uiw-showing');
    }

    function close() {
        root?.classList.remove('uiw-open');
        document.body.classList.remove('uiw-showing');
    }

    function show(list) {
        slides = list;
        const r = ensureRoot();
        r.querySelector('.uiw-bars').innerHTML = slides.map(() => '<i><b></b></i>').join('');
        r.querySelector('.uiw-stage').innerHTML = slides.join('');
        at = -1;
        go(0);
    }

    function go(n) {
        if (!root || !slides.length) return;
        if (n >= slides.length) return close();
        at = Math.max(0, n);
        root.querySelectorAll('.uiw-slide').forEach((el, i) => {
            el.classList.toggle('uiw-on', i === at);
            el.classList.toggle('uiw-past', i < at);
        });
        root.querySelectorAll('.uiw-bars i').forEach((el, i) => el.classList.toggle('uiw-done', i <= at));
        const num = root.querySelectorAll('.uiw-slide')[at]?.querySelector('[data-count]');
        if (num) countUp(num);
    }

    function countUp(el) {
        const target = Number(el.dataset.count) || 0;
        const t0 = performance.now();
        const step = (t) => {
            const k = Math.min(1, (t - t0) / 900);
            el.textContent = String(Math.round(target * (1 - Math.pow(1 - k, 3))));
            if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    function summaryText(recap) {
        const { one, many } = noun();
        const st = recap.stats;
        const ai = recap.ai ?? {};
        return [
            `${s().likeIcon} My ${one} Wrapped — ${new Date(recap.at).toLocaleDateString()}`,
            ai.title ? `Taste: ${ai.title}` : '',
            `${st.total} ${many} across ${st.cards} cards`,
            st.top.length ? `Top 5: ${st.top.slice(0, 5).map((x, i) => `${i + 1}. ${x.name} (${x.n})`).join(', ')}` : '',
            st.tags.length ? `Top tags: ${st.tags.slice(0, 5).map(([t]) => `#${t}`).join(' ')}` : '',
            ai.closer ?? '',
        ].filter(Boolean).join('\n');
    }

    let current = null;

    async function onClick(e) {
        const act = e.target.closest('[data-w]')?.dataset.w;
        if (act === 'close') return close();
        if (act === 'copy') {
            try {
                await navigator.clipboard.writeText(summaryText(current));
                e.target.closest('button').innerHTML = '<i class="fa-solid fa-check"></i> Copied';
            } catch { /* clipboard blocked */ }
            return;
        }
        if (act === 'retry') return make();
        if (e.target.closest('button, a')) return;
        // tap the left third to go back, anywhere else to go on
        const x = e.clientX / window.innerWidth;
        go(x < 0.33 ? at - 1 : at + 1);
    }

    function loading(text, error) {
        const { many } = noun();
        const icon = esc(s().likeIcon);
        show([`<div class="uiw-slide uiw-loading">
            <div class="uiw-bigicon${error ? '' : ' uiw-pulse'}">${icon}</div>
            <h2>${esc(text)}</h2>
            ${error
                ? `<p class="uiw-err">${esc(error)}</p><div class="uiw-actions"><button type="button" data-w="retry" class="uiw-primary">Try again</button><button type="button" data-w="close">Close</button></div>`
                : `<p>Counting your ${esc(many.toLowerCase())} and looking for patterns…</p>`}
        </div>`]);
        root.querySelector('.uiw-bars').innerHTML = '';
    }

    // ---------- public ----------

    async function make() {
        if (busy) return;
        const now = countNow();
        const { many } = noun();
        applyTheme(s().likeLabel, s().likeIcon);
        open();
        if (now.total < 1) {
            loading(`No ${many.toLowerCase()} yet`, `Hand out a few ${many.toLowerCase()} first, then come back for your recap.`);
            return;
        }
        busy = true;
        loading(`Wrapping up your ${many.toLowerCase()}`);
        const prev = recaps()[0] ?? null;
        const diff = compare(now, prev ? prev.stats && { ...prev.stats, at: prev.at, ai: prev.ai } : null);
        try {
            const ai = await writeUp(now, diff, prev);
            const recap = {
                at: Date.now(),
                label: s().likeLabel,
                icon: s().likeIcon,
                stats: { total: now.total, cards: now.cards, top: now.top.map(({ avatar, name, n, tags }) => ({ avatar, name, n, tags })), tags: now.tags },
                ai,
            };
            recaps().unshift(recap);
            recaps().splice(KEEP);
            h.save();
            current = recap;
            show(buildSlides(recap, diff));
            document.dispatchEvent(new CustomEvent('uio:recap'));
        } catch (err) {
            console.error('[UI Overhaul] recap failed', err);
            loading('That didn\'t work', String(err?.message ?? err));
        } finally {
            busy = false;
        }
    }

    // Replays a saved recap, compared with the one before it.
    function replay(index) {
        const list = recaps();
        const recap = list[index];
        if (!recap) return;
        const prev = list[index + 1];
        applyTheme(recap.label ?? s().likeLabel, recap.icon ?? s().likeIcon);
        open();
        current = recap;
        const stats = recap.stats;
        const diff = prev ? compare({ ...stats, top: stats.top.map(x => ({ ...x, name: x.name })) }, { ...prev.stats, at: prev.at, ai: prev.ai }) : null;
        show(buildSlides(recap, diff));
    }

    return {
        make,
        replay,
        list: () => recaps(),
        theme: () => wrappedTheme(s().likeLabel, s().likeIcon),
        newSinceLast() {
            const prev = recaps()[0];
            const now = countNow();
            return prev ? now.total - (prev.stats?.total ?? 0) : now.total;
        },
    };
}
