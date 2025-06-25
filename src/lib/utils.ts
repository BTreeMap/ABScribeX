/**
 * Sleep for a specified number of milliseconds.
 * @param ms Number of milliseconds to sleep.
 * @returns promise that resolves after the specified time.
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determines if a tag name represents an editable form element
 * @param tagName - The HTML tag name to check
 * @returns true if the element is an input, textarea, or select element
 */
export function isEditableFormElementTag(tagName?: string): boolean {
    if (!tagName) return false;
    tagName = tagName.toLowerCase();
    return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

/**
 * Extracts the appropriate content from an HTML element.
 * 
 * For editable form elements (input, textarea, select), returns the element's value.
 * For all other elements, returns the innerHTML content.
 * 
 * @param element - The HTML element to extract content from
 * @returns The extracted content as a string, or empty string if element is falsy
 */
export function extractContent(element: Element): string {
    if (!element) return '';

    // Handle editable form elements differently
    if (isEditableFormElementTag(element.tagName)) {
        return (element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value || '';
    }

    // For other elements, use innerHTML
    return element.innerHTML || '';
}