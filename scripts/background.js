// background.js
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
            url: 'https://abtestingtools-frontend.up.railway.app/?secret=8ac934c3-01a4-771b-c585-c8a98c00ab3a',
            type: 'popup',
            width: 400,
            height: 600
        });

    }
});

// content-script.js will contain the code for your popup editor and AI interactions
// ServiceWorker
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.message === "Hello from Content Script") {
            console.log(sender)
            console.log("Received message from Content Script: ", request.message);
            // Handle the message or send a response
            sendResponse({ message: "Hello from ServiceWorker" });
        }
    }
);