import '@testing-library/jest-dom';
import { screen } from '@testing-library/dom';

// Example test
test('should show empty message when list is empty', () => {
  document.body.innerHTML = '<div class="tm-compare-list"></div>';
  // ...call your function that updates the DOM...
  expect(document.querySelector('.tm-compare-list')).toBeInTheDocument();
});