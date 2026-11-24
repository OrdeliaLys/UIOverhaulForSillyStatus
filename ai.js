// Small helpers shared by UI Overhaul's AI features.

export function cut(text, n) {
    const t = String(text ?? '').trim();
    return t.length > n ? `${t.slice(0, n)}…` : t;
}

export function stripThinking(raw) {
    return String(raw ?? '').replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
}

// One request on the user's current connection, outside the chat.
export async function ask(ctx, system, user, responseLength = 2500) {
    const chatCompletion = (ctx.mainApi ?? 'openai') === 'openai';
    const raw = chatCompletion
        ? await ctx.generateRaw({ prompt: [{ role: 'system', content: system }, { role: 'user', content: user }], responseLength })
        : await ctx.generateRaw({ systemPrompt: system, prompt: user, responseLength });
    return stripThinking(raw);
}

// The persona in use: its avatar file, name and description. Names can
// repeat, so the avatar file is found first.
export function personaInfo(ctx) {
    const personas = ctx.powerUserSettings?.personas ?? {};
    const known = (a) => (a && Object.prototype.hasOwnProperty.call(personas, a) ? a : null);
    let avatar = known(document.querySelector('#user_avatar_block .avatar-container.selected')?.getAttribute('data-avatar-id'));
    if (!avatar) {
        for (const im of document.querySelectorAll('#chat .mes[is_user="true"]:not([force_avatar="true"]) .avatar img')) {
            const m = /[?&]type=persona&file=([^&]+)/.exec(im.getAttribute('src') ?? '');
            avatar = known(m ? decodeURIComponent(m[1]) : null);
            if (avatar) break;
        }
    }
    if (!avatar) avatar = Object.keys(personas).find(a => personas[a] === ctx.name1) ?? null;
    const name = ctx.name1 ?? 'User';
    const desc = avatar ? ctx.powerUserSettings?.persona_descriptions?.[avatar]?.description ?? '' : '';
    return { avatar, name, desc: String(desc).replace(/\{\{user\}\}/gi, name) };
}

// The "blunt" rule shared by every writing prompt.
export const BLUNT = 'Don\'t mince words: name sex, kinks, violence and dark themes plainly; vulgar and explicit words are fine.';
export const PRONOUNS = 'Use everyone\'s gender and pronouns exactly as the card and persona state them; never infer them from looks (a femboy keeps the pronouns he was given).';
