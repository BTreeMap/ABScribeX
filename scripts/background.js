(() => {
    const ActionClickedElement = '5e997d48-f5c7-b4e5-c1c4-ff004e1930cd'
    const Secret = '8ac934c3-01a4-771b-c585-c8a98c00ab3a'
    const Tag = 'fd3611f1-f8d5-2162-ea41-95d49150119b'

    let lastClickedElement = null
    const mapTab = new Map()

    // Listen for messages from the content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === ActionClickedElement) {
            lastClickedElement = message.element
        }
    });


    chrome.runtime.onInstalled.addListener(() => {
        chrome.contextMenus.create({
            id: "my-extension-edit",
            title: "Edit with AI",
            contexts: ["editable"]
        });
    });

    function generateRandomHexString() {
        const byteArray = new Uint8Array(8);

        crypto.getRandomValues(byteArray);

        // Convert each byte to a hex string and concatenate them
        const hexString = Array.from(byteArray, byte =>
            byte.toString(16).padStart(2, '0')
        ).join('');

        return hexString;
    }

    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
        if (info.menuItemId === "my-extension-edit") {
            console.log(tab)
            console.log(info)
            const key = generateRandomHexString()
            mapTab.set(key, {
                tab: tab.id,
                id: lastClickedElement.id
            })

            const url = new URL('https://abtestingtools-frontend.up.railway.app/')
            url.searchParams.set('secret', Secret)
            url.searchParams.set('key', key)
            url.searchParams.set('text', lastClickedElement.textContent || '')

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
                const { text, key } = JSON.parse(request.message.substring(Tag.length))
                console.log("Received message from Content Script: ", text, key);
                const value = mapTab.get(key)
                if (value) {
                    const { tab, id } = value
                    console.log(tab, id)
                    chrome.scripting.executeScript(
                        {
                            target: { tabId: tab },
                            args: [text, id],
                            func: (text, id) => {
                                const elem = document.querySelector(`#${id}`)
                                if (elem) {
                                    elem.innerHTML = text
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