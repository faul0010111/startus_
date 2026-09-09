export async function send(endpoint: string, source: string, body: unknown): Promise<void> {
  const response = await fetch(`${endpoint}/v1/signals/${source}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${source} rejected with ${response.status}`);
}
