// Content Script (inject this into your online editor page)

(() => {
    const trigger = (keyword) => {
        const buttons = document.querySelectorAll('button')
        for (const button of buttons) {
            if (button.textContent.toLowerCase().startsWith(keyword)) {
                button.click()
                return
            }
        }
    }

    const url = new URL(location.href)

    if (url.searchParams.get('secret') === '8ac934c3-01a4-771b-c585-c8a98c00ab3a') {
        trigger('try')
        chrome.runtime.onMessage.addListener(
            function (request, sender, sendResponse) {
                if (request.message === "Hello from ServiceWorker") {
                    console.log("Received message from ServiceWorker: ", request.message);
                    // Handle the message or send a response
                    sendResponse({ message: "Hi, ServiceWorker!" });
                }
            }
        );

        // Send a message to the ServiceWorker
        chrome.runtime.sendMessage({ message: "Hello from Content Script" }, function (response) {
            console.log("Received response from ServiceWorker: ", response.message);
        });
    }

})()

