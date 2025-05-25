const IdentifierNameV0 = 'abscribe-9hg415uaou3sq7b7';

/**
 * @param {HTMLElement} elem
 * @returns {Object<string, any>?}
 */
const detect = (elem) => {
    const identifier = document.querySelector(`p.${IdentifierNameV0}`)
    if (!identifier) {
        return null
    }
    if (!identifier.textContent) {
        return null
    }
    try {
        const json = JSON.parse(identifier.textContent)
        if (!json) {
            return null
        }
        return json
    } catch {
        return null
    }
}

/**
 * @param {HTMLElement} elem 
 * @param {Object<string, any>} identifier 
 */
const create = (elem, identifier) => {
    if (detect(elem)) {
        return
    }
    const p = document.createElement('p')
    p.classList.add(IdentifierNameV0)
    p.hidden = true
    p.style = 'display: none'
    p.textContent = JSON.stringify(identifier)
    elem.appendChild(p)
}

export { detect, create }