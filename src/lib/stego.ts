// Steganographic alphabet of invisibles
// Characters for START and END markers are now EXCLUDED from this list.
export const INVIS: string[] = [
    '\u200B', '\u200C', '\u200D', '\uFEFF', // Common zero-width characters
    '\u200E', '\u200F',                     // Directional formatting characters
    '\u202A', '\u202B', '\u202C', '\u202D', '\u202E', // More directional formatting (often deprecated but can be used)
    '\u2064',                                 // Invisible Plus
    '\u2066', '\u2067', '\u2068', '\u2069', // Isolate formatting characters
    '\u206A', '\u206B', '\u206C', '\u206D', '\u206E', '\u206F', // More isolate formatting
]; // Length is now 22

// START and END markers use characters NOT in INVIS.
export const START = '\u2060\u2061'; // Word Joiner + Function Application
export const END = '\u2062\u2063';   // Invisible Times + Invisible Separator

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
    const startIndex = stego.indexOf(START);
    if (startIndex === -1) {
        return ""; // START marker not found
    }

    const endIndex = stego.indexOf(END, startIndex + START.length);
    if (endIndex === -1) {
        return ""; // END marker not found after START marker
    }

    const invisibles = stego.substring(startIndex + START.length, endIndex);

    // Validate characters in the extracted payload
    for (const char of invisibles) {
        if (INVIS.indexOf(char) === -1) {
            return ""; // Invalid character in payload
        }
    }

    if (invisibles.length === 0) {
        return "";
    }

    const base = BigInt(INVIS.length);
    let num = 0n;
    try {
        num = invisibles.split('').reduce((acc, ch) => {
            const idx = BigInt(INVIS.indexOf(ch));
            if (idx < 0) throw new Error("Invalid character in stego payload during reduce");
            return acc * base + idx;
        }, 0n);
    } catch (e) {
        return ""; // Error during reduction, likely due to bad char not caught (shouldn't happen)
    }

    const bytes: number[] = [];
    if (num === 0n) {
        if (invisibles === INVIS[0] && invisibles.length === 1) {
            return new TextDecoder().decode(new Uint8Array(bytes));
        }
    }

    while (num > 0n) {
        bytes.unshift(Number(num & 0xffn));
        num >>= 8n;
    }

    try {
        return new TextDecoder().decode(new Uint8Array(bytes));
    } catch (e) {
        return ""; // Error during text decoding
    }
}

const regex_raw = START + '([\\s\\S]*?)' + END;
const regex_single = new RegExp(regex_raw);
const regex_global = new RegExp(regex_raw, 'g');

/**
 * Strip stego payload from HTML.
 * @param {string} html The HTML string.
 * @returns {string} The HTML string with steganographic data removed.
 */
export function stripStego(html: string): string {
    return html.replace(regex_global, '');
}

/**
 * Extract and parse stego JSON payload from HTML.
 * @param {string} html The HTML string.
 * @returns {any | null} The parsed JSON object or null if not found or invalid.
 */
export function extractStego(html: string): any | null {
    const match = html.match(regex_single);

    if (!match || match[1] === undefined) {
        return null;
    }

    try {
        const stegoData = `${START}${match[1]}${END}`;
        const msg = decode(stegoData);

        if (msg === "") {
            return null;
        }
        return JSON.parse(msg);
    } catch (e) {
        return null;
    }
}
