# Problem and MVP Scope

## Problem
A privacy violation can only become visible after correlating data transfers across multiple services. Distributed audit logs may be delayed, arrive out of order, or be incomplete. Isolated alerting misses context; naive graph reconstruction risks treating guesses as facts.

## Users
Engineering/SRE, security incident responders, privacy/compliance investigators.

## MVP capabilities
1. Choose one synthetic scenario.
2. Analyze a JSON batch of audit events from multiple services.
3. Build an evidence-backed directed graph.
4. Evaluate two explicit policy rules: deny PII to unapproved external destinations; deny purpose incompatible with an allowlist.
5. Return `VERIFIED_VIOLATION`, `POTENTIAL_VIOLATION`, `INCONCLUSIVE`, or `NO_VIOLATION_OBSERVED` with references to evidence.
6. Display graph, findings and explanation in one browser page.
7. Optional AI narrative using only event IDs/metadata provided, with deterministic offline fallback.

## No-go conditions
- No fabricated event or claim that missing evidence proves transfer.
- No raw customer PII.
- No private company package, config, or service access.
- Never claim production compliance certification or GDPR legal determination.

## Success signal
One click per scenario; findings reproducible for the same evidence regardless of arrival order, with uncertain edges visually distinguished.
