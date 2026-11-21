# Demo Script (Judges)

## Key message
> TraceGuard AI detects privacy risks that isolated audit events cannot reveal, while clearly distinguishing observed evidence from inferred relationships.

## Proposed 2–3 minute flow
1. **Problem (15 sec):** One audit log cannot show cross-service lineage. Logs are out of order and incomplete.
2. **Allowed flow (20 sec):** Select S01; graph shows approved path and no violation observed.
3. **Leak (45 sec):** Select S02; external destination flagged; click observed edge and event ID proof.
4. **Robustness (35 sec):** Select S03; same result when input order changes.
5. **Honest uncertainty (35 sec):** Select S04; missing intermediate event is marked unverified; explain why full source attribution is not proven.
6. **AI investigator (30 sec):** Explain the finding using evidence IDs; show fallback if network unavailable.
7. **Codex development (15 sec):** Show PR timeline, tests generated and reviewed using Codex; do not claim AI verified more than it did.

## Backup scenarios
- If AI is down: deterministic explanation panel.
- If Live backend is down: start local Go API from README; fallback screenshot allowed only if needed, clearly labeled.
- If graph styling breaks: use simple evidence table; no misleading depiction.

## Claims to avoid
- "All missing events can be reconstructed".
- "AI proves all privacy violations".
- "No violation observed means compliant".
