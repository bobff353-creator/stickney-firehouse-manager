export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
    },
    cache: "no-store",
  });
  let value: unknown;
  try {
    value = await res.json();
  } catch {
    throw new Error("The server did not return a usable response. Try again.");
  }
  if (!res.ok)
    throw new Error(
      typeof value === "object" &&
        value !== null &&
        "error" in value &&
        typeof value.error === "string"
        ? value.error
        : "The request did not complete. Your changes have not been confirmed.",
    );
  return value as T;
}
