// helpers/click-button.js
// Playwright helper for clicking a button

export async function clickButton(page, buttonIdentifier) {

    // Find the button by its role and name
    const button = page.locator(buttonIdentifier);

    // Wait for and click the button
    await button.waitFor({ state: 'visible' });
    await button.click();

    // Return the button element for further assertions if needed
    return button;

}