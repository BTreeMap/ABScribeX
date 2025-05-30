(async () => {
    const ActionClickedElement = '5e997d48-f5c7-b4e5-c1c4-ff004e1930cd'
    const Secret = '8ac934c3-01a4-771b-c585-c8a98c00ab3a'
    const Tag = 'fd3611f1-f8d5-2162-ea41-95d49150119b'

    importScripts('./identifier.js', './tools.js', './libs/dompurify@3.2.6/purify.js');

    let lastClickedElement = null
    const mapTab = new Map()

    // Listen for messages from the content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === ActionClickedElement) {
            lastClickedElement = message.element
        }
    });

    // Sanitize HTML content using DOMPurify
    const sanitizeHTML = (html) => {
        return DOMPurify.sanitize(html);
    };

    chrome.runtime.onInstalled.addListener(() => {
        chrome.contextMenus.create({
            id: "my-extension-edit",
            title: "Edit with ABScribe",
            contexts: ["editable"]
        });
    });

    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
        if (info.menuItemId === "my-extension-edit") {
            console.log(tab)
            console.log(info)
            const key = tools.generateRandomHexString()
            console.log(lastClickedElement)
            mapTab.set(key, {
                tab: tab.id,
                target: lastClickedElement,
            })

            let content = lastClickedElement.innerHTML
            if (lastClickedElement.tagName.toLowerCase() === 'textarea') {
                content = content.replaceAll('\n', '<br/>')
            }
            // Sanitize content before sending
            const sanitizedContent = sanitizeHTML(content);

            const url = new URL('https://abtestingtools-frontend.up.railway.app/')
            url.searchParams.set('secret', Secret)
            url.searchParams.set('key', key)
            url.searchParams.set('content', btoa(sanitizedContent || ''))

            chrome.windows.create({
                url: url.href,
                type: 'popup',
                width: 400,
                height: 600
            });
        }
    });

    chrome.runtime.onMessage.addListener(
        function (request, sender, sendResponse) {
            if (request.message && request.message.startsWith(Tag)) {
                const { content, key } = JSON.parse(request.message.substring(Tag.length))
                console.log("Received message from Content Script: ");
                const value = mapTab.get(key)
                if (value) {
                    const { tab, target } = value
                    chrome.scripting.executeScript(
                        {
                            target: { tabId: tab },
                            args: [content, target], // Content is already sanitized by the sender
                            func: (content, target) => {
                                const textOnly = (html) => {
                                    const htmlWithLineBreaks = html.replace(/<br*?>/g, '\r\n').replace(/<\/p>/g, '</p>\r\n')
                                    const div = document.createElement('div')
                                    div.innerHTML = htmlWithLineBreaks
                                    return div.textContent
                                }

                                console.log(target.classId)
                                const elem = document.querySelector(`.${target.classId}`)
                                console.log(elem)
                                if (elem) {
                                    if (elem.tagName.toLowerCase() === 'textarea') {
                                        elem.textContent = textOnly(content) // textOnly should ideally return safe text
                                    } else {
                                        // Ensure content is sanitized before setting innerHTML
                                        elem.innerHTML = DOMPurify.sanitize(content);
                                    }
                                }
                            }
                        },
                        (results) => {
                            // Callback after script has been injected
                            console.log("Content modified");
                            console.log(results);
                        }
                    );
                }
            }
        }
    );
})()