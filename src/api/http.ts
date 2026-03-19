export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  const rawBody = await response.text();

  if (!contentType.includes('application/json')) {
    const trimmed = rawBody.trim();
    const isHtmlDocument =
      trimmed.startsWith('<!doctype html') ||
      trimmed.startsWith('<html');

    if (isHtmlDocument) {
      throw new Error('API returned HTML instead of JSON. Check that the /api endpoint exists and is running.');
    }

    throw new Error('API returned a non-JSON response.');
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new Error('API returned invalid JSON.');
  }
}
