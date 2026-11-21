# GitHub Repo + Branch and PR Workflow

## Set up
- Create exactly **one original repo**: `traceguard-ai` (private until team explicitly approves public visibility). Do not fork/copy the corporate repository.
- Invite all 4 collaborators with appropriate access.
- Create GitHub Project: `TraceGuard AI — 7h MVP` with columns `Backlog`, `Ready`, `In Progress`, `Review`, `Done`.
- Add labels: `area:frontend`, `area:backend`, `type:framework`, `type:feature`, `type:test`, `priority:P0`, `priority:P1`, `blocked`.
- Create Issues from `docs/07-sprint-board.md`.

## Branches

```text
main
├── feat/fe-framework-graph
├── feat/fe-investigation
├── feat/be-framework-lineage
└── feat/be-detection-ai
```

## Codex session setup
- Each engineer works in their own clone or Git worktree and Codex session.
- Respect `AGENTS.md` and your prompt under `prompts/`.
- No unapproved shared contract edits. A contract change is a separate PR with FE/BE acknowledgement.
- Use small PRs at the 10:40 bootstrap gate, 12:30 end-to-end gate, and as necessary afterward.

## PR checklist
- [ ] Scope matches the assigned issue and owner files.
- [ ] No private modules, corporate URLs, credentials or copied source.
- [ ] OpenAPI spec and generated code agree (if HTTP changed).
- [ ] Relevant tests/build pass with real command output.
- [ ] No raw PII in logs, prompts or test datasets.
- [ ] Evidence classifications are technically accurate.
- [ ] Demo remains runnable on main.

## Release captain
One engineer merges, monitors build health, and controls scope; avoid 4 parallel merges into `main` with unresolved conflicts.
