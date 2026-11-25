// Accents: pick an accent and a strength per character. Whenever that
// character is in the scene, a short note goes in near the end of the
// prompt, where models follow it reliably, so the accent doesn't fade or
// spread to others. Profiles are built from how each first language shapes
// English (grammar, rhythm, words, sounds) rather than token foreign words.

import { ask, cut, BLUNT } from './ai.js';

export const ACCENTS = {
    french: {
        name: 'French', flag: '🇫🇷',
        grammar: 'literal French structures: "I am here since one hour", "I have twenty years", "it is not possible"; questions by tone ("You are coming?"); few contractions; tag "no?" or "non?"',
        sound: '"th" becomes z/s ("zis", "ze", "sink"); dropped h ("\'ow", "\'ere", "\'ungry"); stress on the last syllable; "eet" for "it" only when thick',
        words: 'eh bien, voilà, bof, alors, mon Dieu, chéri(e), n\'est-ce pas, comment dire…, putain when cursing',
        rhythm: 'searches for words ("how you say…"), shrugging understatement, a little theatrical',
        sample: '"Ah, non, non. You cannot just come \'ere like zis, without to call first. Comment dire… it is very rude, no?"',
    },
    japanese: {
        name: 'Japanese', flag: '🇯🇵',
        grammar: 'drops articles and plurals ("I go to store"); topic first ("This food… very delicious"); avoids a direct "no" ("That is a little… difficult"); formal, polite phrasing; repeats apologies',
        sound: 'light: "th" as s/z; at thick only, a soft extra vowel on some word endings ("sank you", "very nice-u")',
        words: 'ano…, eto…, hai, sou desu ne, sugoi, maa, -san / -chan / -kun / -sama, kawaii, baka when annoyed',
        rhythm: 'hesitant fillers, indirect and polite, sentences trail off instead of finishing a refusal',
        sample: '"Ano… sorry, sorry. I did not know this is your seat. Maa, if is okay… I sit here only a little, ne?"',
    },
    mandarin: {
        name: 'Mandarin Chinese', flag: '🇨🇳',
        grammar: 'verbs stay in the present ("Yesterday I go"); no articles; "already" marks finished actions ("I eat already"); "can or not?"; doubled words for emphasis ("very very good", "slowly slowly")',
        sound: 'final consonants softened or dropped; "th" as s/d; light respelling only',
        words: 'aiya, wah, hao, ah or la at the end of sentences, dui dui, mei you, ni hao, laoban',
        rhythm: 'direct, blunt, practical; short sentences; haggling energy',
        sample: '"Aiya, why you so late? Food already cold! Sit, sit. You eat or not?"',
    },
    singlish: {
        name: 'Singlish / Malaysian', flag: '🇸🇬',
        grammar: '"can" / "cannot" as whole answers; "got" for has/there is ("Got people inside"); drops "is"; repeats for emphasis; "already" for completed; "one" ending ("He very fierce one")',
        sound: 'clipped, fast; little respelling needed',
        words: 'lah, leh, lor, meh, sia, alamak, walao eh, shiok, paiseh, kiasu, abuden',
        rhythm: 'rapid, cheeky, particles at the end of almost every line',
        sample: '"Walao eh, you serious or not? Cannot lah, the boss sure scold one. Later then go, can?"',
    },
    korean: {
        name: 'Korean', flag: '🇰🇷',
        grammar: 'drops articles and often subjects; verbs at the end of longer thoughts; polite forms with elders; "very" doubled when excited',
        sound: 'at moderate+: f as p ("pine" for fine), z as j ("jero"); thick: soft "-eu" on final consonants ("Starbucks-eu")',
        words: 'aigoo, omo, daebak, jinjja?, ani, ne, hwaiting!, oppa / unnie / hyung / noona, ya!',
        rhythm: 'swings from polite to dramatic, lots of exclamations',
        sample: '"Omo, jinjja? You make this for me? Aigoo… is so pretty. Thank you, really, really thank you."',
    },
    russian: {
        name: 'Russian', flag: '🇷🇺',
        grammar: 'drops articles and "is" ("He here?", "Is cold"); free word order ("Good soup, this"); blunt statements of fact',
        sound: 'w as v ("vhat"), "th" as z, h as a throaty kh; rolled r',
        words: 'da, nyet, nu, davai, blyat (cursing), ladno, bozhe moi, moy dorogoy / moya dorogaya',
        rhythm: 'flat, matter-of-fact, deadpan fatalistic humor',
        sample: '"Nyet. You do not go out in this. Is minus thirty, you die, then who I argue with? Davai, sit."',
    },
    german: {
        name: 'German', flag: '🇩🇪',
        grammar: 'verb pushed to the end of side clauses ("because I it not knew"); "already" for impatience ("Come already"); tag "or?"; "since" for durations; very literal',
        sound: 'w as v ("vhy"), "th" as z/s, final d as t ("ant"), crisp consonants',
        words: 'ja, genau, ach, doch, na ja, mein Gott, Scheiße, Schatz, also',
        rhythm: 'precise, direct, slightly formal, dry humor',
        sample: '"Ja, but this is not how it works, or? First you ask, then you take. Ach, never mind. Come already."',
    },
    spanish: {
        name: 'Spanish', flag: '🇪🇸',
        grammar: 'subject dropped ("Is very late", "Is my house"); adjective after noun; double negatives ("I don\'t say nothing"); tag "no?"',
        sound: 'extra e before s + consonant ("espeak", "estupid"); short i as ee ("leetle", "theeng"); b and v blur',
        words: 'mira, oye, ay, Dios mío, cariño, pues, vale, joder (Spain) or órale (Mexico), mi amor',
        rhythm: 'fast, warm, expressive, rising and falling',
        sample: '"Ay, mira, cariño, is not my fault! I tell you before, no? Is a leetle bit dangerous, pero you don\'t listen."',
    },
    italian: {
        name: 'Italian', flag: '🇮🇹',
        grammar: 'subject dropped ("Is beautiful"); adjective after noun; exclamations as whole sentences',
        sound: 'at moderate+: a soft vowel after some final consonants ("big-a", "it\'s-a"); dropped h ("\'ouse")',
        words: 'allora, dai, mamma mia, madonna, ecco, basta, cara / caro, tesoro, figurati',
        rhythm: 'musical and animated, talks with the hands, quick mood swings',
        sample: '"Allora, listen to me, tesoro. You go, you come back, is-a fine. But you don\'t lie to me, capito? Basta."',
    },
    irish: {
        name: 'Irish', flag: '🇮🇪',
        grammar: '"after" perfect ("I\'m after eating"); "so it is" tags; "himself / herself" for the boss; "ye" for plural you',
        sound: '"th" as t or d ("tree" for three); soft r; "me" for my',
        words: 'grand, sure, eejit, feck, craic, wee, yer man / yer one, go way outta that',
        rhythm: 'lilting, storytelling, teasing',
        sample: '"Ah, go way outta that. Sure I\'m only after getting here meself. Yer man\'s an eejit, so he is."',
    },
    scottish: {
        name: 'Scottish', flag: '🏴',
        grammar: '"cannae" / "dinnae" / "willnae"; "ye" for you; "aye" for yes',
        sound: 'rolled r; "oo" for "ou" ("aboot", "hoose"); dropped g ("nothin\'")',
        words: 'aye, wee, ken, lass / lad, bonnie, och, numpty, braw, greetin\' (crying)',
        rhythm: 'warm but blunt, dry sarcasm',
        sample: '"Och, ye cannae be serious, lass. Wee bit o\' rain never killed naebody. Get yer boots on."',
    },
    southern: {
        name: 'Southern US', flag: '🇺🇸',
        grammar: '"y\'all", "fixin\' to", "might could", "ain\'t", double modals',
        sound: 'drawn-out vowels, dropped g ("darlin\'", "nothin\'"), "I" as "Ah" when thick',
        words: 'sugar, darlin\', bless your heart, howdy, reckon, yonder, holler',
        rhythm: 'slow, warm, sweet-talking even when insulting',
        sample: '"Well bless your heart, sugar. Y\'all were fixin\' to leave without sayin\' goodbye? I reckon not."',
    },
    cockney: {
        name: 'Cockney / London', flag: '🇬🇧',
        grammar: '"ain\'t", "innit", "me" for my, double negatives',
        sound: 'dropped h ("\'ow", "\'ouse"), glottal t ("bo\'le", "wa\'er"), "th" as f/v ("fink", "muvver")',
        words: 'mate, love, guv, bloody, bruv, proper, blimey, innit, sod off',
        rhythm: 'quick, cheeky, street-smart',
        sample: '"Oi, \'ow\'d you get in \'ere, love? Ain\'t nobody s\'posed to know abaht this place, innit."',
    },
    indian: {
        name: 'Indian English', flag: '🇮🇳',
        grammar: '"itself" / "only" for emphasis ("today itself", "I was there only"); "isn\'t it?" as a universal tag; continuous forms ("I am knowing him"); "do one thing…"',
        sound: 'crisp t and d, w and v close together; light respelling only',
        words: 'yaar, arre, achha, ji, bas, haan, na, beta, chalo',
        rhythm: 'warm, fast, expressive, polite teasing',
        sample: '"Arre yaar, why you are worrying so much? Do one thing, sit, have chai. We will fix it today itself, achha?"',
    },
    arabic: {
        name: 'Arabic', flag: '🌙',
        grammar: 'drops "is/are" ("He very tired"); oaths for emphasis; generous, formal greetings',
        sound: 'at moderate+: p as b ("beoble", "blease"); emphatic h',
        words: 'yalla, habibi / habibti, wallah, inshallah, khalas, ya (before names), mashallah',
        rhythm: 'warm, emphatic, hospitable, dramatic',
        sample: '"Wallah, habibti, I tell you the truth! Yalla, come, come, sit. Khalas, no more fighting tonight."',
    },
    custom: { name: 'Custom', flag: '✏️' },
};

const STRENGTH = [
    null,
    'a hint: mostly word choice and rhythm, an occasional grammar slip, almost no respelling',
    'clearly there: their grammar habits in most lines, a couple of respelled sounds per line, a native word now and then',
    'thick: grammar habits in nearly every line, frequent respelled sounds, native words and fillers, but every line stays easy to read',
];
export const STRENGTH_NAMES = ['', 'Hint', 'Moderate', 'Thick'];

export function createAccents(h) {
    // h: { ctx, settings, save, escapeHtml }
    const KEY = 'uio_accents';
    const esc = h.escapeHtml;

    function store() {
        const s = h.settings();
        if (!s.accents || typeof s.accents !== 'object') s.accents = {};
        return s.accents;
    }

    const keyForCard = (avatar) => `card:${avatar}`;
    const keyForName = (name) => `name:${String(name).trim().toLowerCase()}`;

    function get(key) {
        return store()[key] ?? null;
    }

    function set(key, value) {
        if (!value || !value.id) delete store()[key];
        else store()[key] = value;
        h.save();
        update();
    }

    function describe(a) {
        if (!a?.id) return 'None';
        const p = ACCENTS[a.id];
        const nm = a.id === 'custom' ? (a.custom?.name || 'Custom') : p?.name;
        return `${nm} · ${STRENGTH_NAMES[a.strength ?? 2]}`;
    }

    function profileText(a) {
        const p = a.id === 'custom' ? (a.custom ?? {}) : ACCENTS[a.id];
        if (!p) return '';
        const parts = [
            p.grammar && `Grammar: ${p.grammar}`,
            p.sound && `Sounds: ${p.sound}`,
            p.words && `Words and fillers: ${p.words}`,
            p.rhythm && `Rhythm: ${p.rhythm}`,
            p.sample && `Example: ${p.sample}`,
            a.notes && `Notes: ${a.notes}`,
        ].filter(Boolean);
        return parts.join('. ');
    }

    function line(name, a) {
        const p = a.id === 'custom' ? (a.custom ?? {}) : ACCENTS[a.id];
        const label = a.id === 'custom' ? (p.name || 'their own') : p.name;
        return `- ${name}: ${label} accent, ${STRENGTH[a.strength ?? 2]}. ${profileText(a)}`;
    }

    // Who has an accent in the current scene.
    function activeEntries() {
        const c = h.ctx();
        const out = [];
        const seen = new Set();
        const add = (name, a) => {
            if (!a?.id || !name || seen.has(name.toLowerCase())) return;
            seen.add(name.toLowerCase());
            out.push({ name, a });
        };
        if (c.groupId) {
            const g = c.groups?.find(x => String(x.id) === String(c.groupId));
            for (const avatar of g?.members ?? []) {
                const ch = c.characters?.find(x => x?.avatar === avatar);
                if (ch) add(ch.name, get(keyForCard(avatar)));
            }
        } else {
            const ch = c.characters?.[c.characterId];
            if (ch) add(ch.name, get(keyForCard(ch.avatar)));
        }
        // Side characters (by name) who were around in the last messages.
        const recent = (c.chat ?? []).slice(-10).map(m => String(m?.mes ?? '')).join('\n').toLowerCase();
        for (const [k, a] of Object.entries(store())) {
            if (!k.startsWith('name:')) continue;
            const name = a.displayName ?? k.slice(5);
            if (recent.includes(k.slice(5))) add(name, a);
        }
        return out;
    }

    function update() {
        const c = h.ctx();
        if (!c.setExtensionPrompt) return;
        const entries = h.settings().enabled ? activeEntries() : [];
        const text = entries.length
            ? `[Accents. Write these characters' spoken dialogue with their accent, every time they speak, and keep it up for the whole chat. Narration stays in normal English, and nobody else picks it up. Carry it mostly through grammar, rhythm and word choice; respell sounds only as much as the strength says, keeping every line readable. Base it on how real speakers talk, not cartoon stereotypes.\n${entries.map(e => line(e.name, e.a)).join('\n')}]`
            : '';
        // In the chat, one message from the end: close to where the reply is written.
        c.setExtensionPrompt(KEY, text, 1, 1, false, 0);
    }

    async function sample(name, a) {
        const c = h.ctx();
        const system = 'You write short in-character dialogue samples showing a character\'s accent, for an adult fiction app. Reply with the lines only.';
        const user = `Character: ${name}. Accent: ${a.id === 'custom' ? (a.custom?.name || 'custom') : ACCENTS[a.id]?.name}, ${STRENGTH[a.strength ?? 2]}.\n${profileText(a)}\n\n` +
            'Write 3 short lines this character might say (one greeting someone, one annoyed, one flirty or excited), each on its own line in quotes, with a short *action* if you like. ' +
            'Carry the accent through grammar, rhythm and word choice first, respelling only as much as the strength allows. Stay readable. Base it on how real speakers talk, not stereotypes.';
        return ask(c, system, user, 1500);
    }

    // AI reads a card and suggests an accent (one of the list, or a custom one).
    async function suggest(index) {
        const c = h.ctx();
        try { if (c.unshallowCharacter) await c.unshallowCharacter(index); } catch { /* use what's loaded */ }
        const ch = c.characters?.[index];
        if (!ch) throw new Error('Character not found.');
        const system = 'You pick fitting speech accents for roleplay characters. Reply only in the line format you are given.';
        const user = `Card for ${ch.name}:\n${cut(ch.description || ch.data?.description, 1500)}\n${ch.personality ? `Personality: ${cut(ch.personality, 300)}` : ''}\n${ch.first_mes ? `Opening: ${cut(ch.first_mes, 500)}` : ''}\n\n` +
            `Known accents: ${Object.entries(ACCENTS).filter(([k]) => k !== 'custom').map(([k, v]) => `${k} (${v.name})`).join(', ')}.\n\n` +
            'Which accent fits this character, if any? Reply in exactly this format:\n' +
            'ACCENT: <one key from the list, or "custom", or "none">\nSTRENGTH: <1, 2 or 3>\n' +
            'NAME: <if custom: the accent\'s name>\nGRAMMAR: <if custom: grammar habits>\nSOUNDS: <if custom: how sounds come through>\nWORDS: <if custom: native words and fillers>\nRHYTHM: <if custom: how they talk>\n' +
            `NOTES: <anything specific to this character, one line>\n${BLUNT}`;
        const raw = await ask(c, system, user, 1500);
        const f = {};
        for (const l of raw.split(/\r?\n/)) {
            const m = /^[\s*#\-]*\**(ACCENT|STRENGTH|NAME|GRAMMAR|SOUNDS|WORDS|RHYTHM|NOTES)\**\s*[:：]\s*(.*)$/i.exec(l);
            if (m) f[m[1].toUpperCase()] = m[2].replace(/\*\*/g, '').trim();
        }
        const id = String(f.ACCENT ?? '').toLowerCase().replace(/[^a-z]/g, '');
        if (!id || id === 'none') return null;
        const strength = Math.min(3, Math.max(1, parseInt(f.STRENGTH, 10) || 2));
        if (ACCENTS[id] && id !== 'custom') return { id, strength, notes: f.NOTES && !/^none|^-$/i.test(f.NOTES) ? cut(f.NOTES, 200) : '' };
        return {
            id: 'custom', strength,
            custom: { name: cut(f.NAME || 'Custom', 40), grammar: cut(f.GRAMMAR, 300), sound: cut(f.SOUNDS, 300), words: cut(f.WORDS, 300), rhythm: cut(f.RHYTHM, 200) },
            notes: f.NOTES && !/^none|^-$/i.test(f.NOTES) ? cut(f.NOTES, 200) : '',
        };
    }

    // The editor: shared by Stage's sheet and the settings panel.
    function editorHtml(key, name, state = {}) {
        const a = get(key) ?? { id: '', strength: 2 };
        const c = a.custom ?? {};
        return `
            <div class="uio-acc" data-acckey="${esc(key)}" data-accname="${esc(name)}">
                <div class="uio-acc-grid">
                    <button type="button" class="uio-acc-chip${!a.id ? ' uio-on' : ''}" data-acc="">None</button>
                    ${Object.entries(ACCENTS).map(([id, p]) => `<button type="button" class="uio-acc-chip${a.id === id ? ' uio-on' : ''}" data-acc="${id}">${p.flag} ${esc(p.name)}</button>`).join('')}
                </div>
                ${a.id ? `
                <div class="uio-acc-strength">${[1, 2, 3].map(n => `<button type="button" class="${(a.strength ?? 2) === n ? 'uio-on' : ''}" data-accstr="${n}">${STRENGTH_NAMES[n]}</button>`).join('')}</div>
                ${a.id === 'custom' ? `
                    <input class="text_pole" data-accf="name" placeholder="Accent name (e.g. Quebec French, Thai)" value="${esc(c.name ?? '')}">
                    <textarea class="text_pole" rows="2" data-accf="grammar" placeholder="Grammar habits">${esc(c.grammar ?? '')}</textarea>
                    <textarea class="text_pole" rows="2" data-accf="sound" placeholder="How sounds come through">${esc(c.sound ?? '')}</textarea>
                    <textarea class="text_pole" rows="2" data-accf="words" placeholder="Native words and fillers">${esc(c.words ?? '')}</textarea>` : `
                    <p class="uio-acc-about">${esc(ACCENTS[a.id]?.sample ?? '')}</p>`}
                <input class="text_pole" data-accnotes placeholder="Notes (e.g. only when angry, Quebec not Paris)" value="${esc(a.notes ?? '')}">` : ''}
                <div class="uio-acc-actions">
                    ${state.index !== undefined ? `<button type="button" class="menu_button" data-accsuggest="${state.index}"${state.busy === 'suggest' ? ' disabled' : ''}><i class="fa-solid fa-wand-magic-sparkles"></i> ${state.busy === 'suggest' ? 'Reading the card…' : 'Suggest from card'}</button>` : ''}
                    ${a.id ? `<button type="button" class="menu_button" data-accsample${state.busy === 'sample' ? ' disabled' : ''}><i class="fa-solid fa-comment-dots"></i> ${state.busy === 'sample' ? 'Writing…' : 'Read a sample'}</button>` : ''}
                </div>
                ${state.sample ? `<div class="uio-acc-sample">${esc(state.sample).replace(/\n/g, '<br>')}</div>` : ''}
                ${state.error ? `<p class="uio-acc-err">${esc(state.error)}</p>` : ''}
            </div>`;
    }

    // Handles clicks and edits inside an editor; rerender() redraws it and
    // stateFor(key) gives the editor's own state (busy, sample, error).
    function bind(root, rerender, stateFor) {
        root.addEventListener('click', async (e) => {
            const box = e.target.closest('.uio-acc');
            if (!box) return;
            const key = box.dataset.acckey;
            const name = box.dataset.accname;
            const cur = get(key) ?? { id: '', strength: 2 };
            const state = stateFor(key);
            const t = e.target.closest('[data-acc], [data-accstr], [data-accsample], [data-accsuggest]');
            if (!t) return;
            e.stopPropagation();
            if (t.dataset.acc !== undefined) {
                const id = t.dataset.acc;
                set(key, id ? { ...cur, id, displayName: key.startsWith('name:') ? name : undefined } : null);
                state.sample = '';
                return rerender();
            }
            if (t.dataset.accstr) {
                set(key, { ...cur, strength: Number(t.dataset.accstr) });
                return rerender();
            }
            if (t.dataset.accsample !== undefined) {
                state.busy = 'sample';
                state.error = '';
                rerender();
                try {
                    state.sample = await sample(name, get(key));
                } catch (err) {
                    state.error = String(err?.message ?? err);
                }
                state.busy = '';
                return rerender();
            }
            if (t.dataset.accsuggest !== undefined) {
                state.busy = 'suggest';
                state.error = '';
                rerender();
                try {
                    const s = await suggest(Number(t.dataset.accsuggest));
                    if (s) set(key, s);
                    else state.error = 'No accent seems to fit this card.';
                } catch (err) {
                    state.error = String(err?.message ?? err);
                }
                state.busy = '';
                return rerender();
            }
        });
        root.addEventListener('change', (e) => {
            const box = e.target.closest('.uio-acc');
            if (!box) return;
            const key = box.dataset.acckey;
            const cur = get(key);
            if (!cur) return;
            if (e.target.dataset.accnotes !== undefined) set(key, { ...cur, notes: e.target.value.trim() });
            if (e.target.dataset.accf) set(key, { ...cur, custom: { ...(cur.custom ?? {}), [e.target.dataset.accf]: e.target.value.trim() } });
        });
    }

    return { get, set, describe, update, editorHtml, bind, keyForCard, keyForName, activeEntries };
}
