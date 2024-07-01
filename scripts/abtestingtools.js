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

    const sync = (text, key) => {
        chrome.runtime.sendMessage({
            message: Tag + JSON.stringify({
                text,
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

    const key = url.searchParams.get('key') || ''
    trigger('try')
    let target = null
    while (!target) {
        const iframe = document.querySelector('iframe')
        console.log(iframe)
        if (iframe.id && iframe.id.startsWith('tiny')) {
            try {
                target = iframe.contentWindow.document.querySelector('#tinymce')
            } catch { }
        }
        await sleep(500)
    }
    console.log(target.textContent)
    target.textContent = url.searchParams.get('text') || ''
    console.log(target.textContent)
    setInterval(() => {
        sync(target.textContent, key)
    }, 500)

    chrome.runtime.onMessage.addListener(
        function (request, sender, sendResponse) {
            if (request.message && request.message.startsWith(Tag)) {
                const { text, key } = JSON.parse(request.message.substring(Tag.length))
                console.log("Received message from Content Script: ", text, key);
            }
        }
    )
})()

