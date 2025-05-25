(async () => {
    const Secret = '8ac934c3-01a4-771b-c585-c8a98c00ab3a'
    const Tag = 'fd3611f1-f8d5-2162-ea41-95d49150119b'

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    const trigger = (keyword) => {
        const buttons = document.querySelectorAll('button')
        for (const button of buttons) {
            if (button.textContent.toLowerCase().startsWith(keyword)) {
                button.click()
                return
            }
        }
    }

    const sync = (content, key) => {
        chrome.runtime.sendMessage({
            message: Tag + JSON.stringify({
                content,
                key
            })
        }, (response) => {
            console.log("Received response from ServiceWorker: ", response.message);
        })
    }

    // Steganographic alphabet of invisibles
    const INVIS = [
        '\u200B', '\u200C', '\u200D', '\uFEFF',
        '\u200E', '\u200F',
        '\u202A', '\u202B', '\u202C', '\u202D', '\u202E',
        '\u2060', '\u2061', '\u2062', '\u2063', '\u2064',
        '\u2066', '\u2067', '\u2068', '\u2069',
        '\u206A', '\u206B', '\u206C', '\u206D', '\u206E', '\u206F'
    ];
    const START = '\u2060\u2061';
    const END = '\u2062\u2063';

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

    function stripStego(html) {
        const regex = new RegExp(`${START}[\s\S]*?${END}`, 'g');
        return html.replace(regex, '');
    }

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

    const url = new URL(location.href)
    if (url.searchParams.get('secret') !== Secret) {
        return
    }

    const parsedHTML = document.createElement('div')
    // Sanitize HTML string before assigning to innerHTML
    parsedHTML.innerHTML = DOMPurify.sanitize(atob(url.searchParams.get('content') || ''))

    const allowlist = new Set(['div', 'p', 'span', 'br'])
    const isValid = (tagName) => {
        return allowlist.has(tagName)
    }
    /**
     * @param {Element} node 
     */
    const filterNodes = (node) => {
        const childNodes = Array.from(node.children)
        for (const child of childNodes) {
            if (!isValid(child.tagName.toLowerCase())) {
                node.removeChild(child)
            } else {
                filterNodes(child)
            }
        }
    }
    filterNodes(parsedHTML)

    const key = url.searchParams.get('key') || ''
    trigger('try')
    let target = null
    while (!target) {
        const iframe = document.querySelector('iframe')
        console.log(iframe)
        if (iframe !== null && iframe.id && iframe.id.startsWith('tiny')) {
            try {
                target = iframe.contentWindow.document.querySelector('#tinymce')
            } catch { }
        }
        await sleep(500)
    }
    // Sanitize HTML string before assigning stego-enhanced content
    const initialContent = DOMPurify.sanitize(atob(url.searchParams.get('content') || ''));
    const initialData = { oid: '' };
    target.innerHTML = initialContent + encode(JSON.stringify(initialData));

    setInterval(() => {
        // Extract and preserve stego data on each sync
        const current = target.innerHTML;
        const base = stripStego(current);
        const data = extractStego(current) || { oid: '' };
        const sanitized = DOMPurify.sanitize(base);
        sync(sanitized + encode(JSON.stringify(data)), key);
    }, 500)
})();

