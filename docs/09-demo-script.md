# Demo Script (Judges)

## Key message
> TraceGuard AI detects privacy risks that isolated audit events cannot reveal, while clearly distinguishing observed evidence from inferred relationships.

## Demo flow (2 min 45 sec)
1. **Problem (15 sec):** One audit log cannot show cross-service lineage. Logs are out of order and incomplete.
2. **Allowed flow (20 sec):** Turn on **Include cases without violations**, then select S01. The graph shows the approved path and the result is **No violation observed**.
3. **Leak (40 sec):** Select S02. Show the flagged external destination, then click `evt-u-003` under **Evidence references**.
4. **Robustness (15 sec):** Select S03; same result when input order changes.
5. **Honest uncertainty (30 sec):** Select S04; missing intermediate event is marked unverified; explain why full source attribution is not proven.
6. **AI investigator (30 sec):** Explain the finding using evidence IDs.
7. **Codex development (15 sec):** Show PR timeline, tests generated and reviewed using Codex; do not claim AI verified more than it did.

## Backup scenarios
- If AI is down: deterministic explanation panel.
- If Live backend is down: start local Go API from README; fallback screenshot allowed only if needed, clearly labeled.
- If graph styling breaks: use simple evidence table; no misleading depiction.

## Claims to avoid
- "All missing events can be reconstructed".
- "AI proves all privacy violations".
- "No violation observed means compliant".
