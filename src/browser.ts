import { Space2Book } from './index';

declare global {
  interface Window {
    Space2Book: typeof Space2Book;
  }
}

window.Space2Book = Space2Book;
