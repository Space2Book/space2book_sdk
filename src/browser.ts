import { Space2Book } from './index';

declare global { interface Window { Space2Book: typeof Space2Book } }

// A second script load must preserve the first singleton, observers and live forms.
if (!window.Space2Book) {
  window.Space2Book = Space2Book;
  Space2Book.observeDeclarative(document);
}
