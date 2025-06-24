import { describe, it, expect } from 'vitest';
import {
    MessageTypes,
    createMessage,
    sendMessage,
    ClickedElementMessage,
    RequestEditorWindowMessage,
    SyncContentMessage,
    createStorage,
    ContentStorage
} from './config';
import { createContentWithMetadata } from './sanitizer';

describe('MessageTypes', () => {
    it('should have all required message types defined', () => {
        expect(typeof MessageTypes.CLICKED_ELEMENT).toBe('string');
        expect(MessageTypes.CLICKED_ELEMENT).toBeTruthy();

        expect(typeof MessageTypes.REQUEST_EDITOR_WINDOW).toBe('string');
        expect(MessageTypes.REQUEST_EDITOR_WINDOW).toBeTruthy();

        expect(typeof MessageTypes.SYNC_CONTENT).toBe('string');
        expect(MessageTypes.SYNC_CONTENT).toBeTruthy();

        expect(typeof MessageTypes.SANITIZE_HTML).toBe('string');
        expect(MessageTypes.SANITIZE_HTML).toBeTruthy();

        expect(typeof MessageTypes.EXTRACT_TEXT).toBe('string');
        expect(MessageTypes.EXTRACT_TEXT).toBeTruthy();

        expect(typeof MessageTypes.PING_OFFSCREEN).toBe('string');
        expect(MessageTypes.PING_OFFSCREEN).toBeTruthy();

        expect(typeof MessageTypes.SUCCESS).toBe('string');
        expect(MessageTypes.SUCCESS).toBeTruthy();

        expect(typeof MessageTypes.ERROR).toBe('string');
        expect(MessageTypes.ERROR).toBeTruthy();
    });

    it('should create a valid message with createMessage', () => {
        const message = createMessage<ClickedElementMessage>(MessageTypes.CLICKED_ELEMENT, {
            element: {
                tagName: 'div',
                classId: 'test-class',
                actualClickedElementClassId: 'actual-test-class',
                classList: ['test'],
                innerHTML: '<span>test</span>',
                textContent: 'test'
            }
        });

        expect(message.type).toBe(MessageTypes.CLICKED_ELEMENT);
        expect(message.timestamp).toBeTypeOf('number');
        expect(message.element).toBeDefined();
        expect(message.element.tagName).toBe('div');
    });

    it('should create a valid REQUEST_EDITOR_WINDOW message', () => {
        const testContent = createContentWithMetadata('<p>Test content</p>', 'div', true);
        const message = createMessage<RequestEditorWindowMessage>(MessageTypes.REQUEST_EDITOR_WINDOW, {
            editorId: 'abscribex-test-123',
            content: testContent
        });

        expect(message.type).toBe(MessageTypes.REQUEST_EDITOR_WINDOW);
        expect(message.timestamp).toBeTypeOf('number');
        expect(message.editorId).toBe('abscribex-test-123');
        expect(message.content.content).toBe('<p>Test content</p>');
        expect(message.content.isSanitized).toBe(true);
    });

    it('should create a valid SYNC_CONTENT message with editorId', () => {
        const testContent = createContentWithMetadata('<p>Updated content</p>', 'textarea', true);
        const message = createMessage<SyncContentMessage>(MessageTypes.SYNC_CONTENT, {
            editorId: 'abscribex-test-456',
            content: testContent
        });

        expect(message.type).toBe(MessageTypes.SYNC_CONTENT);
        expect(message.timestamp).toBeTypeOf('number');
        expect(message.editorId).toBe('abscribex-test-456');
        expect(message.content.content).toBe('<p>Updated content</p>');
        expect(message.content.isSanitized).toBe(true);
    });
});

describe('Storage Factory', () => {
    it('should create storage instances with different prefixes', () => {
        const contentStorage = createStorage('content');
        const tempStorage = createStorage('temp');
        const cacheStorage = createStorage('cache');

        expect(contentStorage.contentKey('test')).toBe('content_test');
        expect(tempStorage.contentKey('test')).toBe('temp_test');
        expect(cacheStorage.contentKey('test')).toBe('cache_test');
    });

    it('should provide default storage instance', () => {
        expect(ContentStorage.contentKey('test')).toBe('e9hfahco3_test');
    });
});
