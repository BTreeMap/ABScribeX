(() => {
    const ActionClickedElement = '5e997d48-f5c7-b4e5-c1c4-ff004e1930cd'

    // console.log('script injected')
    document.addEventListener('contextmenu', (event) => {
        // Capture the element that was right-clicked
        const clickedElement = event.target;
        // Send a message to the background script with the element's details
        chrome.runtime.sendMessage({
            action: ActionClickedElement,
            element: {
                tagName: clickedElement.tagName,
                id: clickedElement.id,
                classList: clickedElement.classList,
                innerHTML: clickedElement.innerHTML,
                src: clickedElement.src, // if it's an image or other media
                href: clickedElement.href, // if it's a link
            }
        });
    });
})()