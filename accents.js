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
        words: "eh bien (well…, starting a thought), voilà (there it is / done), bof (meh, unimpressed shrug), alors (so…, now then), mon Dieu (my God, shock), chéri / chérie (darling, affectionate), n'est-ce pas (isn't it?, at the end of a statement), putain (fuck, when cursing)",
        rhythm: 'searches for words ("how you say…"), shrugging understatement, a little theatrical',
        sample: '"Ah, non, non. You cannot just come \'ere like zis, without to call first. Comment dire… it is very rude, no?"',
        hard: '"th" words (the, think, three, with), words starting with h (hungry, house, happy), "world", "squirrel", "rural", stress in long words (comfortable, vegetable, development); when a word won\'t come they pause, describe it, or settle for a simpler one',
    },
    japanese: {
        name: 'Japanese', flag: '🇯🇵',
        grammar: 'drops articles and plurals ("I go to store"); topic first ("This food… very delicious"); avoids a direct "no" ("That is a little… difficult"); formal, polite phrasing; repeats apologies',
        sound: 'light: "th" as s/z; at thick only, a soft extra vowel on some word endings ("sank you", "very nice-u")',
        words: "ano… / eto… (um…, hesitating), hai (yes / understood), sou desu ne (I see, that's right, agreeing thoughtfully), sugoi (amazing, impressed), maa (well…, softening), -san / -chan / -kun / -sama (after names: polite / cute / for boys / very respectful), kawaii (cute), baka (idiot, annoyed or teasing)",
        rhythm: 'hesitant fillers, indirect and polite, sentences trail off instead of finishing a refusal',
        sample: '"Ano… sorry, sorry. I did not know this is your seat. Maa, if is okay… I sit here only a little, ne?"',
        hard: 'consonant clusters and word endings (strengths, months, asked, world), "th" words, long Latin words (particularly, unfortunately), choosing between a/the; when a word won\'t come they hesitate ("ano…") and describe it',
    },
    mandarin: {
        name: 'Mandarin Chinese', flag: '🇨🇳',
        grammar: 'verbs stay in the present ("Yesterday I go"); no articles; "already" marks finished actions ("I eat already"); "can or not?"; doubled words for emphasis ("very very good", "slowly slowly")',
        sound: 'final consonants softened or dropped; "th" as s/d; light respelling only',
        words: "aiya (exasperated sigh: oh no / come on), wah (wow, impressed or shocked), hao (okay / fine, agreeing), dui (right / correct, only when agreeing with what someone said), mei you (there isn't any / no), la or ah at the end of a sentence (softens it; sparing)",
        rhythm: 'direct, blunt, practical; short sentences; haggling energy',
        sample: '"Aiya, why you so late? Food already cold! Sit, sit. You eat or not?"',
        hard: 'final consonant clusters (asked, months, sixth, texts), "th" words, plurals and past tense endings, "v" vs "w", long multi-syllable words; when a word won\'t come they describe it plainly',
    },
    singlish: {
        name: 'Singlish / Malaysian', flag: '🇸🇬',
        grammar: '"can" / "cannot" as whole answers; "got" for has/there is ("Got people inside"); drops "is"; repeats for emphasis; "already" for completed; "one" ending ("He very fierce one")',
        sound: 'clipped, fast; little respelling needed',
        words: "lah (end particle for emphasis: 'cannot lah'), leh (end particle, softer or complaining), lor (resigned: 'like that lor'), meh (doubting: 'really meh?'), sia (wow / damn, emphasis), alamak (oh no), walao eh (what the hell, exasperated), shiok (so satisfying), paiseh (embarrassed / sorry), kiasu (afraid to lose out)",
        rhythm: 'rapid, cheeky, particles at the end of almost every line',
        sample: '"Walao eh, you serious or not? Cannot lah, the boss sure scold one. Later then go, can?"',
        hard: 'few; formal or posh British words feel stiff and get swapped for local ones',
    },
    korean: {
        name: 'Korean', flag: '🇰🇷',
        grammar: 'drops articles and often subjects; verbs at the end of longer thoughts; polite forms with elders; "very" doubled when excited',
        sound: 'at moderate+: f as p ("pine" for fine), z as j ("jero"); thick: soft "-eu" on final consonants ("Starbucks-eu")',
        words: "aigoo (oh dear / tsk, sympathy or exasperation), omo (oh my!, surprised), daebak (awesome / huge), jinjja? (really?), ani (no), ne (yes), hwaiting! (you can do it!), oppa / unnie / hyung / noona (older brother or sister, chosen by both speakers' genders), ya! (hey!, sharp, to someone younger or close)",
        rhythm: 'swings from polite to dramatic, lots of exclamations',
        sample: '"Omo, jinjja? You make this for me? Aigoo… is so pretty. Thank you, really, really thank you."',
        hard: '"f" words (coffee, fine, phone), "z" words (zero, zoo, pizza), "th" words, word-final clusters, a/the; Konglish slips ("hand phone" for cell phone)',
    },
    russian: {
        name: 'Russian', flag: '🇷🇺',
        grammar: 'drops articles and "is" ("He here?", "Is cold"); free word order ("Good soup, this"); blunt statements of fact',
        sound: 'w as v ("vhat"), "th" as z, h as a throaty kh; rolled r',
        words: "da (yes), nyet (no), nu (well…, so…), davai (come on / let's go), blyat (fuck, cursing), ladno (fine / okay, giving in), bozhe moi (my God), moy dorogoy / moya dorogaya (my dear, to a man / to a woman)",
        rhythm: 'flat, matter-of-fact, deadpan fatalistic humor',
        sample: '"Nyet. You do not go out in this. Is minus thirty, you die, then who I argue with? Davai, sit."',
        hard: 'a/the (dropped or misplaced), "th" words, "w" words (water, world, wow), short vowels (ship/sheep, full/fool), phrasal verbs (put up with, get over)',
    },
    german: {
        name: 'German', flag: '🇩🇪',
        grammar: 'verb pushed to the end of side clauses ("because I it not knew"); "already" for impatience ("Come already"); tag "or?"; "since" for durations; very literal',
        sound: 'w as v ("vhy"), "th" as z/s, final d as t ("ant"), crisp consonants',
        words: "ja (yes), genau (exactly, agreeing), ach (oh, sighing), doch (yes it is!, contradicting a 'no'), na ja (well…, hedging), mein Gott (my God), Scheiße (shit), Schatz (darling), also (so / well, starting a sentence; never 'also' in the English sense)",
        rhythm: 'precise, direct, slightly formal, dry humor',
        sample: '"Ja, but this is not how it works, or? First you ask, then you take. Ach, never mind. Come already."',
        hard: '"th" words, "w" vs "v" (very, wine, vacation), soft "j" (jump, just), phrasal verbs and idioms; false friends ("become" meaning get, "actual" meaning current)',
    },
    spanish: {
        name: 'Spanish', flag: '🇪🇸',
        grammar: 'subject dropped ("Is very late", "Is my house"); adjective after noun; double negatives ("I don\'t say nothing"); tag "no?"',
        sound: 'extra e before s + consonant ("espeak", "estupid"); short i as ee ("leetle", "theeng"); b and v blur',
        words: "mira (look…, to get attention), oye (hey / listen), ay (oh!, any strong feeling), Dios mío (my God), cariño (sweetheart), pues (well…, filler), vale (okay, Spain), joder (fuck, Spain) or órale (alright / let's go, Mexico), mi amor (my love)",
        rhythm: 'fast, warm, expressive, rising and falling',
        sample: '"Ay, mira, cariño, is not my fault! I tell you before, no? Is a leetle bit dangerous, pero you don\'t listen."',
        hard: 'words starting with s + consonant (school, speak, stop), "sh" vs "ch" (sheep, chair), "j" and "y" (yes, jelly), short i vs ee (ship/sheep, live/leave), "th" words; false friends ("embarrassed" ≠ pregnant, "actually")',
    },
    italian: {
        name: 'Italian', flag: '🇮🇹',
        grammar: 'subject dropped ("Is beautiful"); adjective after noun; exclamations as whole sentences',
        sound: 'at moderate+: a soft vowel after some final consonants ("big-a", "it\'s-a"); dropped h ("\'ouse")',
        words: "allora (so / well then), dai (come on!), mamma mia (oh my), madonna (God!, frustration), ecco (there / here it is), basta (enough!), cara / caro (dear, to a woman / man), tesoro (treasure, darling), figurati (don't mention it / as if!)",
        rhythm: 'musical and animated, talks with the hands, quick mood swings',
        sample: '"Allora, listen to me, tesoro. You go, you come back, is-a fine. But you don\'t lie to me, capito? Basta."',
        hard: 'words starting with h, "th" words, word-final consonants (a soft vowel creeps in), short i vs ee, silent letters (knife, Wednesday, island)',
    },
    irish: {
        name: 'Irish', flag: '🇮🇪',
        grammar: '"after" perfect ("I\'m after eating"); "so it is" tags; "himself / herself" for the boss; "ye" for plural you',
        sound: '"th" as t or d ("tree" for three); soft r; "me" for my',
        words: "grand (fine, okay), sure (as a softener: 'sure it's fine'), eejit (idiot), feck (mild fuck), craic (fun / gossip: 'what's the craic?'), wee (small), yer man / yer one (that guy / that woman), go way outta that (no way!, disbelief)",
        rhythm: 'lilting, storytelling, teasing',
        sample: '"Ah, go way outta that. Sure I\'m only after getting here meself. Yer man\'s an eejit, so he is."',
        hard: 'none really; they just use their own words for things',
    },
    scottish: {
        name: 'Scottish', flag: '🏴',
        grammar: '"cannae" / "dinnae" / "willnae"; "ye" for you; "aye" for yes',
        sound: 'rolled r; "oo" for "ou" ("aboot", "hoose"); dropped g ("nothin\'")',
        words: "aye (yes), wee (small), ken (know / you know), lass / lad (girl / boy), bonnie (pretty), och (oh, exasperated), numpty (idiot), braw (great), greetin' (crying)",
        rhythm: 'warm but blunt, dry sarcasm',
        sample: '"Och, ye cannae be serious, lass. Wee bit o\' rain never killed naebody. Get yer boots on."',
        hard: 'none really; they just use their own words for things',
    },
    southern: {
        name: 'Southern US', flag: '🇺🇸',
        grammar: '"y\'all", "fixin\' to", "might could", "ain\'t", double modals',
        sound: 'drawn-out vowels, dropped g ("darlin\'", "nothin\'"), "I" as "Ah" when thick',
        words: "sugar / darlin' (affectionate, to anyone), bless your heart (sympathy, or a polite insult), howdy (hello), reckon (think / suppose), yonder (over there), holler (shout / call)",
        rhythm: 'slow, warm, sweet-talking even when insulting',
        sample: '"Well bless your heart, sugar. Y\'all were fixin\' to leave without sayin\' goodbye? I reckon not."',
        hard: 'none; posh or technical words come out sounding put-on',
    },
    cockney: {
        name: 'Cockney / London', flag: '🇬🇧',
        grammar: '"ain\'t", "innit", "me" for my, double negatives',
        sound: 'dropped h ("\'ow", "\'ouse"), glottal t ("bo\'le", "wa\'er"), "th" as f/v ("fink", "muvver")',
        words: "mate (friend, to anyone), love (to a woman or anyone, friendly), guv (boss / sir), bloody (intensifier), bruv (bro), proper (very: 'proper good'), blimey (wow), innit (isn't it, tag at the end), sod off (go away)",
        rhythm: 'quick, cheeky, street-smart',
        sample: '"Oi, \'ow\'d you get in \'ere, love? Ain\'t nobody s\'posed to know abaht this place, innit."',
        hard: 'none; posh or formal words come out sounding put-on',
    },
    indian: {
        name: 'Indian English', flag: '🇮🇳',
        grammar: '"itself" / "only" for emphasis ("today itself", "I was there only"); "isn\'t it?" as a universal tag; continuous forms ("I am knowing him"); "do one thing…"',
        sound: 'crisp t and d, w and v close together; light respelling only',
        words: "yaar (buddy / man, friendly), arre (hey / oh, surprise or protest), achha (okay / I see / really?), ji (respectful, after names or as 'yes'), bas (enough / that's it), haan (yes), na (tag: 'come na'), beta (child, from someone older), chalo (let's go / okay then)",
        rhythm: 'warm, fast, expressive, polite teasing',
        sample: '"Arre yaar, why you are worrying so much? Do one thing, sit, have chai. We will fix it today itself, achha?"',
        hard: '"v" vs "w" (very, wet), "th" words, some idioms and slang (they use their own instead), British vs American usage mixing',
    },
    arabic: {
        name: 'Arabic', flag: '🌙',
        grammar: 'drops "is/are" ("He very tired"); oaths for emphasis; generous, formal greetings',
        sound: 'at moderate+: p as b ("beoble", "blease"); emphatic h',
        words: "yalla (come on / let's go), habibi / habibti (my dear, to a man / to a woman), wallah (I swear, emphasis), inshallah (God willing; also a polite maybe), khalas (enough / done), ya before a name (calling them: 'ya Kira'), mashallah (praise, admiring something)",
        rhythm: 'warm, emphatic, hospitable, dramatic',
        sample: '"Wallah, habibti, I tell you the truth! Yalla, come, come, sit. Khalas, no more fighting tonight."',
        hard: '"p" words (people, please, pepper), "v" words (very, voice), vowel-heavy words, consonant clusters (strengths, splendid), a/the and is/are',
    },
    custom: { name: 'Custom', flag: '✏️' },
};

const STRENGTH = [
    null,
    'a hint: mostly word choice and rhythm, an occasional grammar slip, almost no respelling, and a native word only rarely (not every reply)',
    'clearly there: their grammar habits in most lines, a couple of respelled sounds per line, and at most one native word per reply',
    'thick: grammar habits in nearly every line, frequent respelled sounds, and at most two native words per reply; every line stays easy to read',
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
        if (!value || (!value.id && !value.unknown?.length)) delete store()[key];
        else store()[key] = value;
        h.save();
        update();
    }

    function describe(a) {
        const n = a?.unknown?.length ?? 0;
        if (!a?.id) return n ? `No accent · ${n} unknown word${n === 1 ? '' : 's'}` : 'None';
        const p = ACCENTS[a.id];
        const nm = a.id === 'custom' ? (a.custom?.name || 'Custom') : p?.name;
        return `${nm} · ${STRENGTH_NAMES[a.strength ?? 2]}${n ? ` · ${n} unknown` : ''}`;
    }

    function profileText(a) {
        const p = a.id === 'custom' ? (a.custom ?? {}) : (ACCENTS[a.id] ?? {});
        const parts = [
            p.grammar && `Grammar: ${p.grammar}`,
            p.sound && `Sounds: ${p.sound}`,
            p.words && `Native words they may use (only with these meanings, in these situations): ${p.words}`,
            p.rhythm && `Rhythm: ${p.rhythm}`,
            p.hard && !/^none/i.test(p.hard) && `Hard for them: ${p.hard}. Now and then (not every line) they stumble on these: a slightly off pronunciation, a pause to find the word, a simpler word instead, or asking how to say it`,
            p.sample && `Example: ${p.sample}`,
            a.notes && `Notes: ${a.notes}`,
            a.unknown?.length && `English words they have shown they don't know: ${a.unknown.join(', ')}. They never use these words themselves. When someone else uses one, they react like someone who doesn't know it (ask what it means, guess wrong, or talk around it), until it's been explained to them in the story`,
        ].filter(Boolean);
        return parts.join('. ');
    }

    function line(name, a) {
        if (!a.id) return `- ${name}: ${profileText(a)}`;
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
            if (!(a?.id || a?.unknown?.length) || !name || seen.has(name.toLowerCase())) return;
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
            ? `[Accents and vocabulary. Write these characters' spoken dialogue with their accent, every time they speak, and keep it up for the whole chat. Narration stays in normal English, and nobody else picks it up. Carry it mostly through grammar, rhythm and word choice; respell sounds only as much as the strength says, keeping every line readable. ` +
                'Native words are rare seasoning, not a verbal tic: only from the list, only with the meaning given, only where a real speaker would naturally say it, and never more than the strength allows. ' +
                'Never translate or gloss: no foreign word followed by its English meaning ("mot… (word)", "X, which means Y"). If a word wouldn\'t be clear from context, say it in English instead. ' +
                'When they can\'t find an English word they hesitate, describe it or pick a simpler one; they don\'t switch to their own language mid-sentence. ' +
                `Base it on how real speakers talk, not cartoon stereotypes.\n${entries.map(e => line(e.name, e.a)).join('\n')}]`
            : '';
        // In the chat, one message from the end: close to where the reply is written.
        c.setExtensionPrompt(KEY, text, 1, 1, false, 0);
    }

    async function sample(name, a) {
        const c = h.ctx();
        const system = 'You write short in-character dialogue samples showing a character\'s accent, for an adult fiction app. Reply with the lines only.';
        const user = `Character: ${name}. Accent: ${a.id === 'custom' ? (a.custom?.name || 'custom') : ACCENTS[a.id]?.name}, ${STRENGTH[a.strength ?? 2]}.\n${profileText(a)}\n\n` +
            'Write 3 short lines this character might say (one greeting someone, one annoyed, one flirty or excited), each on its own line in quotes, with a short *action* if you like. ' +
            'Carry the accent through grammar, rhythm and word choice first, respelling only as much as the strength allows. Stay readable. ' +
            'Use native words sparingly (at most one across the three lines unless the strength is thick), only with the meanings listed, and never add a translation or gloss after a foreign word. ' +
            'Base it on how real speakers talk, not stereotypes.';
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
            'NAME: <if custom: the accent\'s name>\nGRAMMAR: <if custom: grammar habits>\nSOUNDS: <if custom: how sounds come through>\nWORDS: <if custom: a few native words, each with its meaning in brackets>\nRHYTHM: <if custom: how they talk>\nHARD: <if custom: English words and sounds that are hard for them>\n' +
            `NOTES: <anything specific to this character, one line>\n${BLUNT}`;
        const raw = await ask(c, system, user, 1500);
        const f = {};
        for (const l of raw.split(/\r?\n/)) {
            const m = /^[\s*#\-]*\**(ACCENT|STRENGTH|NAME|GRAMMAR|SOUNDS|WORDS|RHYTHM|HARD|NOTES)\**\s*[:：]\s*(.*)$/i.exec(l);
            if (m) f[m[1].toUpperCase()] = m[2].replace(/\*\*/g, '').trim();
        }
        const id = String(f.ACCENT ?? '').toLowerCase().replace(/[^a-z]/g, '');
        if (!id || id === 'none') return null;
        const strength = Math.min(3, Math.max(1, parseInt(f.STRENGTH, 10) || 2));
        if (ACCENTS[id] && id !== 'custom') return { id, strength, notes: f.NOTES && !/^none|^-$/i.test(f.NOTES) ? cut(f.NOTES, 200) : '' };
        return {
            id: 'custom', strength,
            custom: { name: cut(f.NAME || 'Custom', 40), grammar: cut(f.GRAMMAR, 300), sound: cut(f.SOUNDS, 300), words: cut(f.WORDS, 300), rhythm: cut(f.RHYTHM, 200), hard: cut(f.HARD, 300) },
            notes: f.NOTES && !/^none|^-$/i.test(f.NOTES) ? cut(f.NOTES, 200) : '',
        };
    }

    // ---------- words they don't know ----------

    const COMMON = new Set(('the a an some any this that these those it what which who whom whose where when why how here there ' +
        'you your yours me my mine him her his hers them they their we us our ours one ones thing things something ' +
        'anything nothing everything that\'s happening wrong going on up so then now true real really yes no okay ok ' +
        'sorry love life time name place way problem matter difference point idea plan meaning deal story it\'s ' +
        'do does did have has had be is are was were am will would can could should mean means meant say said').split(/\s+/));

    function cleanWord(w) {
        return String(w ?? '').toLowerCase().replace(/[^a-z' -]/g, '').replace(/^['\s-]+|['\s-]+$/g, '').trim();
    }

    // strict: from automatic detection, so common words, phrases built on
    // them, and names are skipped. Words you add by hand always go in.
    function learnUnknown(key, word, displayName, strict = false) {
        const raw = String(word ?? '').trim();
        const w = cleanWord(raw);
        if (!w) return false;
        if (strict) {
            const parts = w.split(/\s+/);
            if (w.length < 3 || w.length > 30 || parts.length > 3) return false;
            if (COMMON.has(parts[0]) || parts.every(x => COMMON.has(x))) return false;
            if (/^[A-Z]/.test(raw.replace(/^['‘’*_]+/, ''))) return false; // a name, not a word
        }
        const cur = get(key) ?? { id: '', strength: 2 };
        const list = cur.unknown ?? [];
        if (list.includes(w)) return false;
        set(key, { ...cur, unknown: [...list, w].slice(-40), displayName: key.startsWith('name:') ? (cur.displayName ?? displayName) : cur.displayName });
        return true;
    }

    function forget(key, word) {
        const cur = get(key);
        if (!cur) return;
        set(key, { ...cur, unknown: (cur.unknown ?? []).filter(w => w !== word) });
    }

    // Spoken lines only (text in quotes), with who said them: the message's
    // speaker, or the bold **Name:** that opens the paragraph.
    function spoken(msg) {
        const out = [];
        for (const para of String(msg.mes ?? '').replace(/<[^>]+>/g, ' ').split(/\n+/)) {
            const tag = /^\s*\*\*([^*:]{2,30}):?\*\*\s*:?/.exec(para);
            const who = tag ? tag[1].trim() : null;
            for (const m of para.matchAll(/["“]([^"”]{2,400})["”]/g)) out.push({ who, text: m[1] });
        }
        return out;
    }

    const Q = "['‘’*_]";
    const W = "([A-Za-z][A-Za-z' -]{2,29}?)";
    const ASKS = [
        // "What is a smartphone?" / "What is mortgage?" (asking for a meaning, not "the X")
        { re: new RegExp(`\\bwhat (?:is|are) (?:an? )?${W}\\s*\\?`, 'gi'), caps: false },
        // "What is 'ghosting'?" / "What is the *afterparty*"
        { re: new RegExp(`\\bwhat (?:is|are|does) (?:an? |the |this |that )?${Q}+${W}${Q}+`, 'gi'), caps: false },
        // "What does 'yeet' mean?"
        { re: new RegExp(`\\bwhat does ${Q}*${W}${Q}* mean\\b`, 'gi'), caps: false },
        // "Mortgage? What is this?"
        { re: new RegExp(`(?:^|[.!?…]\\s+)${Q}*${W}${Q}*\\?\\s*what (?:is|does) (?:this|that|it)\\b`, 'gi'), caps: true },
        // "I do not know this word, mortgage." / "I don't know the word 'brunch'"
        { re: new RegExp(`\\bI (?:do not|don't|did not|didn't) (?:know|understand) (?:this|the|that) word\\s*,?\\s*${Q}*${W}${Q}*(?=[\\s,.!?…]|$)`, 'gi'), caps: false },
    ];

    // After a reply: words the speaker asked about or said they don't know.
    function scanMessage(msg) {
        if (!msg || msg.is_user || msg.is_system) return [];
        const c = h.ctx();
        const found = [];
        for (const { who, text } of spoken(msg)) {
            let key;
            let name;
            if (who) {
                const ch = c.characters?.find(x => x?.name?.toLowerCase() === who.toLowerCase());
                key = ch ? keyForCard(ch.avatar) : keyForName(who);
                name = who;
            } else {
                const ch = c.characters?.find(x => x?.name === msg.name) ?? c.characters?.[c.characterId];
                if (!ch) continue;
                key = keyForCard(ch.avatar);
                name = ch.name;
            }
            for (const { re, caps } of ASKS) {
                re.lastIndex = 0;
                for (const m of text.matchAll(re)) {
                    // At the start of a sentence a capital letter is normal.
                    const word = caps ? m[1].charAt(0).toLowerCase() + m[1].slice(1) : m[1];
                    if (learnUnknown(key, word, name, true)) found.push({ name, word: cleanWord(word) });
                }
            }
        }
        return found;
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
                    <textarea class="text_pole" rows="2" data-accf="words" placeholder="Native words with their meaning, e.g. mai pen rai (never mind)">${esc(c.words ?? '')}</textarea>
                    <textarea class="text_pole" rows="2" data-accf="hard" placeholder="English words and sounds that are hard for them">${esc(c.hard ?? '')}</textarea>` : `
                    <p class="uio-acc-about">${esc(ACCENTS[a.id]?.sample ?? '')}</p>
                    ${ACCENTS[a.id]?.hard ? `<p class="uio-acc-hard"><b>Hard for them:</b> ${esc(ACCENTS[a.id].hard)}</p>` : ''}`}
                <input class="text_pole" data-accnotes placeholder="Notes (e.g. only when angry, Quebec not Paris)" value="${esc(a.notes ?? '')}">` : ''}
                <div class="uio-acc-unknown">
                    <b>Words they don't know</b>
                    <div class="uio-acc-words">${(a.unknown ?? []).map(w => `<span>${esc(w)}<button type="button" data-accunword="${esc(w)}" title="They know it now">×</button></span>`).join('') || '<small>None yet. Words they ask about in the story are added here.</small>'}</div>
                    <input class="text_pole" data-accaddword placeholder="Add a word they don't know, then Enter">
                </div>
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
            const t = e.target.closest('[data-acc], [data-accstr], [data-accsample], [data-accsuggest], [data-accunword]');
            if (!t) return;
            e.stopPropagation();
            if (t.dataset.accunword !== undefined) {
                forget(key, t.dataset.accunword);
                return rerender();
            }
            if (t.dataset.acc !== undefined) {
                const id = t.dataset.acc;
                set(key, id ? { ...cur, id, displayName: key.startsWith('name:') ? name : undefined } : (cur.unknown?.length ? { unknown: cur.unknown, displayName: cur.displayName } : null));
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
                    if (s) set(key, { ...s, unknown: cur.unknown });
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
            if (e.target.dataset.accaddword !== undefined) {
                for (const w of e.target.value.split(',')) learnUnknown(key, w, box.dataset.accname);
                e.target.value = '';
                return rerender();
            }
            const cur = get(key);
            if (!cur) return;
            if (e.target.dataset.accnotes !== undefined) set(key, { ...cur, notes: e.target.value.trim() });
            if (e.target.dataset.accf) set(key, { ...cur, custom: { ...(cur.custom ?? {}), [e.target.dataset.accf]: e.target.value.trim() } });
        });
        root.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.dataset?.accaddword !== undefined) {
                e.preventDefault();
                e.target.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }

    return { get, set, describe, update, editorHtml, bind, keyForCard, keyForName, activeEntries, scanMessage, learnUnknown, forget };
}
