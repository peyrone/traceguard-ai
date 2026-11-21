# Codex — Release Captain Check

Read `PLANS.md`, `docs/07-sprint-board.md`, `docs/11-quality-gates.md`, `docs/09-demo-script.md`.

Inspect current main branch, detect high-risk integration issues, and produce a prioritized checklist only. Verify with actual commands (Go tests/vet and frontend build). Audit dependency manifests for private modules and inadvertent credentials/PII. Make only limited submission-critical fixes with owner approval; do not rewrite architecture at the deadline. Summarize tests performed, failures, demo steps, and unverified assumptions.
