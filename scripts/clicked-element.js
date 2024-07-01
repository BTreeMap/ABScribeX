(() => {
    const ActionClickedElement = '5e997d48-f5c7-b4e5-c1c4-ff004e1930cd'

    function generateRandomHexString() {
        const byteArray = new Uint8Array(8);

        crypto.getRandomValues(byteArray);

        // Convert each byte to a hex string and concatenate them
        const hexString = Array.from(byteArray, byte =>
            byte.toString(16).padStart(2, '0')
        ).join('');

        return hexString;
    }

    // console.log('script injected')
    document.addEventListener('contextmenu', (event) => {
        // Capture the element that was right-clicked
        const clickedElement = event.target;
        // Send a message to the background script with the element's details
        let namedElement = clickedElement;
        while (!namedElement.id) {
            namedElement = namedElement.parentNode
        }
        const classId = 'x' + generateRandomHexString()
        clickedElement.classList.add(classId)
        chrome.runtime.sendMessage({
            action: ActionClickedElement,
            element: {
                tagName: clickedElement.tagName,
                id: clickedElement.id,
                parentId: namedElement.id,
                classId,
                classList: clickedElement.classList,
                innerHTML: clickedElement.innerHTML,
                textContent: clickedElement.textContent,
                src: clickedElement.src, // if it's an image or other media
                href: clickedElement.href, // if it's a link
            }
        });
    });
})()