const IdentifierNameV0 = 'abscribe-9hg415uaou3sq7b7';

/**
 * Detects an identifier JSON object embedded in a hidden <p> tag within the given element.
 * @param {HTMLElement} elem The parent element to search within.
 * @returns {Record<string, any> | null} The parsed JSON object or null if not found or invalid.
 */
export const detect = (elem: HTMLElement): Record<string, any> | null => {
    const identifier = elem.querySelector(`p.${IdentifierNameV0}`);
    if (!identifier) {
        return null;
    }
    if (!identifier.textContent) {
        return null;
    }
    try {
        const json = JSON.parse(identifier.textContent);
        if (!json) {
            return null;
        }
        return json;
    } catch {
        return null;
    }
};

/**
 * Creates and appends a hidden <p> tag with a JSON stringified identifier to the given element.
 * Does nothing if an identifier already exists.
 * @param {HTMLElement} elem The element to append the identifier to.
 * @param {Record<string, any>} identifier The identifier object to embed.
 */
export const create = (elem: HTMLElement, identifier: Record<string, any>): void => {
    if (detect(elem)) {
        return;
    }
    const p = document.createElement('p');
    p.classList.add(IdentifierNameV0);
    p.hidden = true;
    p.style.display = 'none';
    p.textContent = JSON.stringify(identifier);
    elem.appendChild(p);
};
