type Visibility = "public" | "private";

/** Serialize saving and privacy changes so sharing reuses the same artwork. */
export function createCreationSync(fetcher: typeof fetch = (...args) => fetch(...args)) {
  const records = new Map<string, { id?: string; visibility?: Visibility; pending: Promise<unknown> }>();
  return async (key: string, form: FormData, visibility: Visibility): Promise<string> => {
    let record = records.get(key);
    if (!record) {
      record = { pending: Promise.resolve() };
      records.set(key, record);
    }
    const current = record;
    const operation = current.pending.catch(() => undefined).then(async () => {
      if (current.id && current.visibility === visibility) return current.id;
      form.set("visibility", visibility);
      const response = await fetcher(current.id ? `/api/creations/${current.id}` : "/api/creations", {
        method: current.id ? "PATCH" : "POST",
        ...(current.id ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visibility }) } : { body: form }),
      });
      const result = await response.json() as { creation?: { id: string }; error?: string };
      if (!response.ok || !result.creation?.id) throw new Error(result.error || "Could not save artwork.");
      current.id = result.creation.id;
      current.visibility = visibility;
      return current.id;
    });
    current.pending = operation;
    return operation;
  };
}
