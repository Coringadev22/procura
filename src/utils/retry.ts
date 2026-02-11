import pRetry from "p-retry";

export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retries = 3
): Promise<Response> {
  return pRetry(
    async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000); // 10s timeout
      try {
        const res = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        if (res.status >= 500) {
          throw new Error(`Server error ${res.status} for ${url}`);
        }
        return res;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    {
      retries,
      minTimeout: 1000,
      factor: 2,
    }
  );
}
