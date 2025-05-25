/**
 * Generates a random 8-byte hexadecimal string.
 * @returns {string} A 16-character hex string.
 */
export const generateRandomHexString = (): string => {
    const byteArray = new Uint8Array(8);
    crypto.getRandomValues(byteArray);
    // Convert each byte to a hex string and concatenate them
    const hexString = Array.from(byteArray, (byte) =>
        byte.toString(16).padStart(2, '0')
    ).join('');
    return hexString;
};
