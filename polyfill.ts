import DOMMatrix from 'dommatrix';

if (typeof global !== 'undefined' && !(global as any).DOMMatrix) {
  (global as any).DOMMatrix = DOMMatrix;
}
