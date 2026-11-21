# Review Queue event ID labels

**Goal**

Show audit event IDs as the row headings in the Dashboard Review Queue. Each row continues to open its scenario’s workspace and report.

**Implementation**

1. Extend `frontend/src/app/App.test.tsx` to verify that a finding’s `evt-003` appears as its queue heading, that the opt-in clear case displays its graph event ID, and that missing references display `No event ID available`. Run the dashboard tests and confirm the assertions fail against the current scenario headings.
2. In `frontend/src/app/Dashboard.tsx`, render the primary finding’s `evidence_event_ids` in its queue heading. When there is no finding, use the graph’s `evidence_event_ids`. List distinct IDs using comma separators. Show `No event ID available` for an empty list. Keep the existing finding selection and scenario-based links. This uses existing analysis fields and requires no contract change.
3. From `frontend/`, run `npm test`, `npm run build`, and `git diff --check`. Confirm the dashboard test still opens the selected scenario and report.
