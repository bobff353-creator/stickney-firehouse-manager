/** Refresh server snapshots without discarding other locally edited rows. */
export function preserveEditorDrafts<T extends { id: string }>(current: T[], incoming: T[], savedId?: string) {
  const byId = new Map(current.map(item => [item.id, item]));
  return incoming.map(item => item.id === savedId ? item : byId.get(item.id) ?? item);
}
