import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

// Os formulários do Ant Design demoram a renderizar no jsdom, ainda mais com
// a cobertura ligada; 1 s (o padrão do findBy/waitFor) fica no limite
configure({ asyncUtilTimeout: 5000 });

// Desmonta os componentes e limpa a sessão entre um teste e outro
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

// APIs do navegador que o Ant Design usa e o jsdom não implementa
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// O jsdom não aceita o pseudo-elemento no getComputedStyle (usado pelo AntD)
const getComputedStyleOriginal = window.getComputedStyle;
window.getComputedStyle = (elt) => getComputedStyleOriginal(elt);

window.scrollTo = () => {};
