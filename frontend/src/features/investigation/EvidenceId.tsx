export function EvidenceId({ id, onInspect }: { id: string; onInspect?: (id: string) => void }) {
  if (!onInspect) return <code>{id}</code>;
  return <button className="evidence-id" type="button" onClick={() => onInspect(id)}><code>{id}</code></button>;
}
