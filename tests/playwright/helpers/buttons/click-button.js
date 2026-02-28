// helpers/click-button.js
// Playwright helper for clicking a button

export async function clickButton(page, buttonName) {

    // Find the button by its role and name
    const button = page.getByRole('button', { name: buttonName });

    // Wait for and click the button
    await button.waitFor({ state: 'visible' });
    await button.click();

}