(() => {
    const secret = '8ac934c3-01a4-771b-c585-c8a98c00ab3a'
    const tag = 'fd3611f1-f8d5-2162-ea41-95d49150119b'

    chrome.runtime.onInstalled.addListener(() => {
        chrome.contextMenus.create({
            id: "my-extension-edit",
            title: "Edit with AI",
            contexts: ["editable"]
        });
    });

    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
        if (info.menuItemId === "my-extension-edit") {
            console.log(tab)
            console.log(info)
            chrome.windows.create({
                url: `https://abtestingtools-frontend.up.railway.app/?secret=${secret}`,
                type: 'popup',
                width: 400,
                height: 600
            });

        }
    });

    chrome.runtime.onMessage.addListener(
        function (request, sender, sendResponse) {
            if (request.message.startsWith(tag)) {
                const content = JSON.parse(request.message.substring(tag.length))
                console.log("Received message from Content Script: ", content);
                // Handle the message or send a response
                sendResponse({ message: "Hello from ServiceWorker" });
            }
        }
    );
})()