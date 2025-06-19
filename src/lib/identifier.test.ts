import { describe, it, expect, beforeEach, vi } from 'vitest';
import { detect, create } from './identifier';

// Mock document and HTMLElement for jsdom environment
// Vitest with 'jsdom' environment should handle this, but explicit mocks can be useful.

describe('identifier', () => {
    let parentElement: HTMLElement;
    const IdentifierNameV0 = 'abscribe-9hg415uaou3sq7b7'; // Match the internal constant

    beforeEach(() => {
        // Reset the document body for each test to avoid interference
        document.body.innerHTML = '';
        parentElement = document.createElement('div');
        document.body.appendChild(parentElement);
    });

    describe('create', () => {
        it('should create and append a hidden <p> tag with JSON content', () => {
            const identifierData = { id: 'test1', type: 'test' };
            create(parentElement, identifierData);

            const pElement = parentElement.querySelector(`p.${IdentifierNameV0}`) as HTMLParagraphElement;
            expect(pElement).not.toBeNull();
            expect(pElement.hidden).toBe(true);
            expect(pElement.style.display).toBe('none');
            expect(pElement.textContent).toBe(JSON.stringify(identifierData));
        });

        it('should not create a new identifier if one already exists', () => {
            const initialIdentifierData = { id: 'initial', version: 1 };
            create(parentElement, initialIdentifierData);

            const firstPElement = parentElement.querySelector(`p.${IdentifierNameV0}`);
            const countBefore = parentElement.querySelectorAll(`p.${IdentifierNameV0}`).length;

            const newIdentifierData = { id: 'new', version: 2 };
            create(parentElement, newIdentifierData); // Attempt to create again

            const countAfter = parentElement.querySelectorAll(`p.${IdentifierNameV0}`).length;
            const pElement = parentElement.querySelector(`p.${IdentifierNameV0}`) as HTMLParagraphElement;

            expect(countAfter).toBe(countBefore);
            expect(pElement.textContent).toBe(JSON.stringify(initialIdentifierData)); // Should remain the first one
        });
    });

    describe('detect', () => {
        it('should return null if no identifier <p> tag is found', () => {
            expect(detect(parentElement)).toBeNull();
        });

        it('should return null if the identifier <p> tag has no text content', () => {
            const p = document.createElement('p');
            p.classList.add(IdentifierNameV0);
            p.hidden = true;
            parentElement.appendChild(p);
            p.textContent = null; // Explicitly set to null
            expect(detect(parentElement)).toBeNull();
        });

        it('should return null if the text content is not valid JSON', () => {
            const p = document.createElement('p');
            p.classList.add(IdentifierNameV0);
            p.hidden = true;
            p.textContent = 'not json';
            parentElement.appendChild(p);
            expect(detect(parentElement)).toBeNull();
        });

        it('should return the parsed JSON object if a valid identifier is found', () => {
            const identifierData = { id: 'test2', value: 123 };
            const p = document.createElement('p');
            p.classList.add(IdentifierNameV0);
            p.hidden = true;
            p.textContent = JSON.stringify(identifierData);
            parentElement.appendChild(p);

            const detectedData = detect(parentElement);
            expect(detectedData).toEqual(identifierData);
        });

        it('should return null if JSON.parse returns null (e.g. textContent is "null")', () => {
            const p = document.createElement('p');
            p.classList.add(IdentifierNameV0);
            p.hidden = true;
            p.textContent = 'null'; // string "null" parses to null
            parentElement.appendChild(p);
            expect(detect(parentElement)).toBeNull();
        });
    });
});
