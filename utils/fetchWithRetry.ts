/**
 * Fetch wrapper with automatic retry and exponential backoff.
 * Only retries on server errors (5xx), timeouts (408), and rate limits (429).
 * Client errors (4xx) are NOT retried.
 *
 * @param url - The URL to fetch
 * @param options - Standard fetch options + optional AbortSignal
 * @param retries - Number of retries (default 3)
 * @param baseDelay - Base delay in ms before first retry (default 1000)
 * @returns Promise<Response>
 */
export async function fetchWithRetry(
    url: string,
    options?: RequestInit,
    retries: number = 3,
    baseDelay: number = 1000
): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, options);

            // Don't retry client errors (4xx) except 408 (timeout) and 429 (rate limit)
            if (response.ok || (response.status >= 400 && response.status < 500
                && response.status !== 408 && response.status !== 429)) {
                return response;
            }

            // Retryable server error — save for potential rethrow
            lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);

            // If this was the last attempt, return the response as-is (let caller handle error)
            if (attempt === retries) {
                return response;
            }
        } catch (error: any) {
            // Network error or AbortError
            if (error.name === 'AbortError') {
                throw error; // Never retry aborts
            }
            lastError = error;

            if (attempt === retries) {
                throw error;
            }
        }

        // Wait with exponential backoff: 1s → 2s → 4s
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`[fetchWithRetry] Attempt ${attempt + 1}/${retries + 1} failed for ${url}. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Should not reach here, but just in case
    throw lastError || new Error('fetchWithRetry: all attempts failed');
}
