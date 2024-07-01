(() => {
    const Secret = '8ac934c3-01a4-771b-c585-c8a98c00ab3a'
    const Tag = 'fd3611f1-f8d5-2162-ea41-95d49150119b'

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

    if (url.searchParams.get('secret') === Secret) {
        const key = url.searchParams.get('key') || ''
        trigger('try')
        setInterval(() => {
            sync(document.querySelector('#tinymce', key).textContent)
        }, 1000)
    }

})()

