/**
 * Generates a random identifier string from 20 random bytes (160 bits).
 * @returns {string} A 32-character lowercase base32 string.
 */
export const generateIdentifier = (prefix: string = ''): string => {
    const byteArray20 = new Uint8Array(20); // 160 bits = 20 bytes
    crypto.getRandomValues(byteArray20);
    return prefix + toBase32(byteArray20);
};

/**
 * Converts a byte array to a lowercase base32 string.
 * @param {Uint8Array} bytes - The byte array to convert.
 * @returns {string} A base32 encoded string.
 */
const toBase32 = (bytes: Uint8Array): string => {
    // Base32 alphabet (RFC 4648) - lowercase
    const base32Alphabet = 'abcdefghijklmnopqrstuvwxyz234567';

    // Convert bytes to base32
    let base32String = '';
    for (let i = 0; i < bytes.length; i += 5) {
        // Take up to 5 bytes (40 bits) at a time
        let chunk = 0;
        let bitsInChunk = 0;

        for (let j = 0; j < 5 && i + j < bytes.length; j++) {
            chunk = (chunk << 8) | bytes[i + j];
            bitsInChunk += 8;
        }

        // Extract 5-bit groups from right to left
        const chunkChars = [];
        while (bitsInChunk >= 5) {
            chunkChars.unshift(base32Alphabet[chunk & 0x1F]);
            chunk >>= 5;
            bitsInChunk -= 5;
        }

        // Handle remaining bits if any
        if (bitsInChunk > 0) {
            chunkChars.unshift(base32Alphabet[(chunk << (5 - bitsInChunk)) & 0x1F]);
        }

        base32String += chunkChars.join('');
    }

    return base32String;
};
