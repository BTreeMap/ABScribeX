// Content Script (inject this into your online editor page)
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