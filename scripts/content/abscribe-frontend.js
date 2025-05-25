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
    // Sanitize HTML string before assigning to innerHTML
    target.innerHTML = DOMPurify.sanitize(atob(url.searchParams.get('content') || ''))
    const tracker = target.querySelector('div[class="ace-00000000"]')
    if (!tracker) {
        const elem = document.createElement('div')
        elem.hidden = true
        elem.textContent = JSON.stringify({
            oid: '' // Added a placeholder value for oid
        })
        target.appendChild(elem) // Appended the new element to the target
    }
    setInterval(() => {
        // Sanitize HTML string before sending
        sync(DOMPurify.sanitize(target.innerHTML), key)
    }, 500)
})()

