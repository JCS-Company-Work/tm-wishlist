require('@testing-library/jest-dom');
const { screen } = require('@testing-library/dom');

describe('toggleList DOM logic (real script)', () => {
  beforeAll(async () => {
    // Simulate global settings required by TMCompare
    global.window.TMWLSettings = { storage_key: 'tm_wishlist_configs' };
    // Dynamically load the real tm-compare.js script
    const fs = require('fs');
    const path = require('path');
    const scriptContent = fs.readFileSync(
      path.resolve(__dirname, '../../assets/js/tm-compare.js'),
      'utf8'
    );
    // Evaluate the script in the test context
    eval(scriptContent);
  });

  function setupToggleListDOM() {
    document.body.innerHTML = `
      <div class="tm-compare-list-wrapper">
        <button class="list-toggle">Toggle</button>
        <div class="tm-compare-list-multi">List Content</div>
      </div>
    `;
  }

  test('clicking toggle button toggles classes', () => {
    setupToggleListDOM();
    // Manually trigger DOMContentLoaded to initialize TMCompare
    document.dispatchEvent(new Event('DOMContentLoaded'));
    const btn = document.querySelector('.list-toggle');
    const wrapper = document.querySelector('.tm-compare-list-wrapper');
    const compareList = wrapper.querySelector('.tm-compare-list-multi');

    // Initial state: no classes
    expect(btn).not.toHaveClass('active');
    expect(compareList).not.toHaveClass('open');

    // Simulate click
    btn.click();
    expect(btn).toHaveClass('active');
    expect(compareList).toHaveClass('open');

    // Simulate another click
    btn.click();
    expect(btn).not.toHaveClass('active');
    expect(compareList).not.toHaveClass('open');
  });
});