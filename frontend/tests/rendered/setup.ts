import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

class ResizeObserverStub implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  configurable: true,
  value: ResizeObserverStub,
});

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: vi.fn(),
});

const localStorageData = new Map<string, string>();
const localStorageStub: Storage = {
  get length() { return localStorageData.size; },
  clear: () => localStorageData.clear(),
  getItem: (key) => localStorageData.get(key) ?? null,
  key: (index) => Array.from(localStorageData.keys())[index] ?? null,
  removeItem: (key) => localStorageData.delete(key),
  setItem: (key, value) => localStorageData.set(key, String(value)),
};

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: localStorageStub,
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.className = '';
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = '';
});
