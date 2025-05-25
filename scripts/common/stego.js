(function(global) {
  // Steganographic alphabet of invisibles
  const INVIS = [
    '\u200B','\u200C','\u200D','\uFEFF',
    '\u200E','\u200F',
    '\u202A','\u202B','\u202C','\u202D','\u202E',
    '\u2060','\u2061','\u2062','\u2063','\u2064',
    '\u2066','\u2067','\u2068','\u2069',
    '\u206A','\u206B','\u206C','\u206D','\u206E','\u206F'
  ];
  const START = '\u2060\u2061';
  const END   = '\u2062\u2063';

  /**
   * Encode a UTF-8 string into zero-width characters.
   */
  function encode(message) {
    const bytes = new TextEncoder().encode(message);
    let num = bytes.reduce((acc, b) => (acc << 8n) + BigInt(b), 0n);
    const base = BigInt(INVIS.length);
    const digits = [];
    while (num > 0n) {
      digits.push(Number(num % base));
      num /= base;
    }
    if (digits.length === 0) digits.push(0);
    const payload = digits.reverse().map(d => INVIS[d]).join('');
    return `${START}${payload}${END}`;
  }

  /**
   * Decode zero-width stego back to the original string.
   */
  function decode(stego) {
    const [, payload = ''] = stego.split(START);
    const [invisibles = ''] = payload.split(END);
    const base = BigInt(INVIS.length);
    let num = invisibles.split('').reduce((acc, ch) => {
      const idx = BigInt(INVIS.indexOf(ch));
      return (acc * base) + idx;
    }, 0n);
    const bytes = [];
    while (num > 0n) {
      bytes.unshift(Number(num & 0xFFn));
      num >>= 8n;
    }
    return new TextDecoder().decode(new Uint8Array(bytes));
  }

  /**
   * Strip stego payload from HTML.
   */
  function stripStego(html) {
    const regex = new RegExp(`${START}[\s\S]*?${END}`, 'g');
    return html.replace(regex, '');
  }

  /**
   * Extract and parse stego JSON payload from HTML.
   */
  function extractStego(html) {
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

  // Expose stego API globally
  global.Stego = { INVIS, START, END, encode, decode, stripStego, extractStego };
})(window);
