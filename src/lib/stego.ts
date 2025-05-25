
// Steganographic alphabet of invisibles
export const INVIS: string[] = [
    '\u200B', '\u200C', '\u200D', '\uFEFF',
    '\u200E', '\u200F',
    '\u202A', '\u202B', '\u202C', '\u202D', '\u202E',
    '\u2060', '\u2061', '\u2062', '\u2063', '\u2064',
    '\u2066', '\u2067', '\u2068', '\u2069',
    '\u206A', '\u206B', '\u206C', '\u206D', '\u206E', '\u206F',
];
export const START = '\u2060\u2061';
export const END = '\u2062\u2063';

/**
 * Encode a UTF-8 string into zero-width characters.
 * @param {string} message The string to encode.
 * @returns {string} The steganographically encoded string.
 */
export function encode(message: string): string {
    const bytes = new TextEncoder().encode(message);
    let num = bytes.reduce((acc, b) => (acc << 8n) + BigInt(b), 0n);
    const base = BigInt(INVIS.length);
    const digits: number[] = [];
    while (num > 0n) {
        digits.push(Number(num % base));
        num /= base;
    }
    if (digits.length === 0) digits.push(0);
    const payload = digits.reverse().map((d) => INVIS[d]).join('');
    return `${START}${payload}${END}`;
}

/**
 * Decode zero-width stego back to the original string.
 * @param {string} stego The steganographically encoded string.
 * @returns {string} The decoded string.
 */
export function decode(stego: string): string {
    const [, payload = ''] = stego.split(START);
    const [invisibles = ''] = payload.split(END);
    const base = BigInt(INVIS.length);
    let num = invisibles.split('').reduce((acc, ch) => {
        const idx = BigInt(INVIS.indexOf(ch));
        return acc * base + idx;
    }, 0n);
    const bytes: number[] = [];
    while (num > 0n) {
        bytes.unshift(Number(num & 0xffn));
        num >>= 8n;
    }
    return new TextDecoder().decode(new Uint8Array(bytes));
}

/**
 * Strip stego payload from HTML.
 * @param {string} html The HTML string.
 * @returns {string} The HTML string with steganographic data removed.
 */
export function stripStego(html: string): string {
    const regex = new RegExp(`${START}[\s\S]*?${END}`, 'g');
    return html.replace(regex, '');
}

/**
 * Extract and parse stego JSON payload from HTML.
 * @param {string} html The HTML string.
 * @returns {any | null} The parsed JSON object or null if not found or invalid.
 */
export function extractStego(html: string): any | null {
    const regex = new RegExp(`${START}([\s\S]*?)${END}`);
    const match = html.match(regex);
    if (!match) return null;
    try {
        const msg = decode(`${START}${match[1]}${END}`);
        return JSON.parse(msg);
    } catch {
        return null;
    }
}
