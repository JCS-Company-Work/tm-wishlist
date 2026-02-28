// helpers/api/capture-api-response.js
// Playwright helper for capturing API responses

export async function captureApiResponse(page, urlPart, method = 'GET') {

    // Wait for the API response
    const [response] = await Promise.all([
        page.waitForResponse(resp => resp.url().includes(urlPart) && resp.request().method() === method)
    ]);

    // Capture and return the response body
    const responseBody = await response.json();
    return responseBody;

}
