const PL_CHARS = {
    ą: 'a',
    ć: 'c',
    ę: 'e',
    ł: 'l',
    ń: 'n',
    ó: 'o',
    ś: 's',
    ź: 'z',
    ż: 'z',
    Ą: 'a',
    Ć: 'c',
    Ę: 'e',
    Ł: 'l',
    Ń: 'n',
    Ó: 'o',
    Ś: 's',
    Ź: 'z',
    Ż: 'z',
};
export function slugify(text) {
    return text
        .trim()
        .split('')
        .map((ch) => PL_CHARS[ch] ?? ch)
        .join('')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-');
}
export function tripSlug(id, name) {
    const slug = slugify(name);
    return slug ? `${id}-${slug}` : String(id);
}
export function parseTripIdFromSlug(idSlug) {
    const match = String(idSlug).match(/^(\d+)/);
    if (!match)
        return null;
    const id = Number(match[1]);
    if (!Number.isInteger(id) || id <= 0)
        return null;
    return id;
}
