import { describe, it, expect } from 'vitest';
import { encode, decode, stripStego, extractStego, INVIS, START, END } from './stego';

describe('steganography functions', () => {
    describe('encode and decode', () => {
        const testMessages = [
            "Hello, World!",
            "Привет, мир!", // Cyrillic
            "こんにちは、世界！", // Japanese
            "你好，世界！", // Chinese
            "👋🌍", // Emojis
            JSON.stringify({ key: "value", num: 123, nested: { arr: [1, "test"] } }),
            "", // Empty string
            "a", // Single character
            "\u200B\u200C\u200D", // String containing some of the INVIS characters (should still work)
        ];

        testMessages.forEach((message) => {
            it(`should correctly encode and decode: "${message.substring(0, 20)}..."`, () => {
                const encoded = encode(message);
                const decoded = decode(encoded);
                expect(decoded).toBe(message);
            });
        });

        it('encoded message should start with START and end with END', () => {
            const message = "test";
            const encoded = encode(message);
            expect(encoded.startsWith(START)).toBe(true);
            expect(encoded.endsWith(END)).toBe(true);
        });

        it('encoded message payload should only contain INVIS characters', () => {
            const message = "test payload";
            const encoded = encode(message);
            const payload = encoded.substring(START.length, encoded.length - END.length);
            for (const char of payload) {
                expect(INVIS).toContain(char);
            }
        });

        it('decode should handle strings not properly framed by START/END (return empty or partial)', () => {
            expect(decode("randomstring")).toBe(""); // No START/END
            expect(decode(START + "abc")).toBe(""); // No END, and abc are not INVIS chars
            const partialPayload = INVIS[1] + INVIS[2];
            expect(decode(START + partialPayload)).toBe(""); // No END
            // This behavior depends on the strictness of the split in decode. Current impl gives empty.
        });
    });

    describe('stripStego', () => {
        it('should remove steganographic data from HTML', () => {
            const message = "secret data";
            const encodedMessage = encode(message);
            const html = `<p>Some text ${encodedMessage} and more text.</p>`;
            const strippedHtml = stripStego(html);
            expect(strippedHtml).toBe("<p>Some text  and more text.</p>");
            expect(strippedHtml).not.toContain(encodedMessage);
        });

        it('should handle multiple steganographic blocks', () => {
            const encoded1 = encode("secret1");
            const encoded2 = encode("secret2");
            const html = `<div>${encoded1}<span>text</span>${encoded2}</div>`;
            const strippedHtml = stripStego(html);
            expect(strippedHtml).toBe("<div><span>text</span></div>");
        });

        it('should return the original HTML if no steganographic data is present', () => {
            const html = "<p>No secrets here.</p>";
            expect(stripStego(html)).toBe(html);
        });
    });

    describe('extractStego', () => {
        it('should extract and parse JSON payload from HTML', () => {
            const jsonData = { info: "confidential", version: 2 };
            const encodedJson = encode(JSON.stringify(jsonData));
            const html = `<p>Content with ${encodedJson} metadata.</p>`;
            const extractedData = extractStego(html);
            expect(extractedData).toEqual(jsonData);
        });

        it('should return null if no steganographic data is found', () => {
            const html = "<p>Plain content.</p>";
            expect(extractStego(html)).toBeNull();
        });

        it('should return null if the steganographic data is not valid JSON', () => {
            const encodedText = encode("not json");
            const html = `<p>${encodedText}</p>`;
            expect(extractStego(html)).toBeNull();
        });

        it('should return null if decoding fails (e.g. corrupted stego string)', () => {
            const corruptedStego = START + INVIS[0] + "not_an_invis_char" + END;
            const html = `<p>${corruptedStego}</p>`;
            // This test's success depends on decode throwing an error or returning something unparsable
            // For now, assuming decode handles it gracefully enough for JSON.parse to fail or return null
            expect(extractStego(html)).toBeNull();
        });

        it('should only extract the first steganographic block if multiple exist', () => {
            const jsonData1 = { first: true };
            const jsonData2 = { second: true };
            const encoded1 = encode(JSON.stringify(jsonData1));
            const encoded2 = encode(JSON.stringify(jsonData2));
            const html = `<p>${encoded1} some text ${encoded2}</p>`;
            expect(extractStego(html)).toEqual(jsonData1);
        });
    });
});
