# TokTickIT — Sprint 4 Peer Review Log

**Author:** @ramy-web92
**Reviewer:** @Maxboox
**Integration flow:** `feature/*` → `lab4-staging` (merge commits, in dependency order) → `main` (release PR)

Every PR below was reviewed on GitHub by @Maxboox (comment on a specific line, then **Approve**) before being merged into `lab4-staging`. The full threads are on each PR page.

| # | PR | Issue | Branch | Reviewer comment (@Maxboox) | Author response (@ramy-web92) | Outcome |
|---|---|---|---|---|---|---|
| 1 | [#42](https://github.com/ramy-web92/toktickit/pull/42) Sprint 4 engineering contract | #43 | feature/lab4-spec | "The day boundaries are hardcoded to Asia/Bangkok. Should this be configurable in case the app is deployed elsewhere?" | Kept Asia/Bangkok as a documented decision (D-05): all users are on campus and Thailand has no daylight saving time; making it configurable is outside the Lab 4 scope. In the same review round the spec was aligned with the Lab 3 schema (int ids, `ADMINISTRATOR`, `currentStatus`) and kept the Lab 3 transition matrix (spec v1.1). | Approved, merged |
| 2 | [#53](https://github.com/ramy-web92/toktickit/pull/53) Actions Taken migration, backfill and seed | #44 | feature/lab4-db | "Why do the new seed tickets use 9000xx numbers instead of continuing from 000005?" | The API generated numbers as `count + 1`, so tickets created by tests already used 000005+ and seed tickets with the same numbers were silently skipped by the upsert. 9000xx is reserved for seed data; the fragile count-based generator was then replaced by `highest + 1` in #60. | Approved, merged |
| 3 | [#54](https://github.com/ramy-web92/toktickit/pull/54) Actions Taken API | #45 | feature/lab4-actions-api | "What happens if two IT Staff complete the same action at the same time?" | The update is guarded by `version` in the WHERE clause, so only the first request matches and increments it; the second gets `409 STALE_UPDATE` with the current action. Covered by API-12. | Approved, merged |
| 4 | [#55](https://github.com/ramy-web92/toktickit/pull/55) Ticket workflow and resolution gate | #46 | feature/lab4-workflow-api | "Why block Resolved when an action is still PLANNED? Maybe IT planned a follow-up for later." | A planned action means work is still expected, so Resolved would be misleading on the dashboards. A later follow-up is recorded by completing the action with `followUpRequired = true` and a note, which does not block resolution. | Approved, merged |
| 5 | [#56](https://github.com/ramy-web92/toktickit/pull/56) Requester and IT Staff dashboard APIs | #47 | feature/lab4-dashboard-api | "Why is the queue filter logic in the dashboard file instead of in the queue route?" | So the dashboard counts and the queue use exactly the same filter; written twice they could drift and a card showing "7" could open a list of 6. API-29 checks every drill-down against its card. | Approved, merged |
| 6 | [#57](https://github.com/ramy-web92/toktickit/pull/57) Actions Taken UI | #48 | feature/lab4-actions-ui | "When there's a conflict, why not just reload the action and drop the user's edits?" | FR-20 requires keeping entered data after recoverable failures. The form is kept, a banner explains the conflict and "Show latest" updates the version to save against, so nobody overwrites the other silently. Covered by UI-09. | Approved, merged |
| 7 | [#58](https://github.com/ramy-web92/toktickit/pull/58) Ticket workflow controls | #49 | feature/lab4-workflow-ui | "In Lab 3 the allowed transitions were hardcoded in StaffTicketDetail. Why move them to the server response?" | One source of truth: the matrix lives in the backend, which enforces it anyway, and the UI only shows what the server allows, so it can never offer a transition the backend would reject. Covered by UI-11 and API-21. | Approved, merged |
| 8 | [#59](https://github.com/ramy-web92/toktickit/pull/59) Dashboards and role navigation | #50 | feature/lab4-dashboards-ui | "Why is each metric card a `<button>` and not just a `<div>` with onClick?" | A button is reachable with Tab, activated with Enter/Space and announced as an action; its aria-label reads the full meaning ("Unassigned: 15. View list"). A clickable div would be invisible to keyboard users. Covered by the keyboard test in RequesterDashboard.test.tsx. | Approved, merged |
| 9 | [#60](https://github.com/ramy-web92/toktickit/pull/60) Final hardening, accessibility and regression | #51 | feature/lab4-hardening | "Why allow an action 1 minute before the Ticket was created? Isn't that breaking BR-09?" | The date/time picker has minute precision, so an action added seconds after a Ticket's creation was sent as "10:00" for a Ticket created at 10:00:42 and was rejected. E2E-01 caught it. The 1-minute tolerance matches the picker without allowing real back-dating (D-13, unit test added). | Approved, merged |
| 10 | Release docs (this file, ai-use.md, final tests.md) | #52 | docs/lab4-release | Reviewed with the release | — | Approved, merged |
| 11 | [Release `lab4-staging` → `main`](https://github.com/ramy-web92/toktickit/pulls?q=is%3Apr+base%3Amain) | #52 | lab4-staging | Reviewed with the release | — | Approved, merged |

## Changes made because of review

- **Spec v1.1** (PR #42): names and transition matrix aligned with the existing Lab 3 code before any implementation PR.
- **Ticket numbering** (raised on PR #53): generator changed from `count + 1` to `highest + 1` in PR #60, test API-33.
- **Action date tolerance** (discussed on PR #60): decision recorded as D-13 in the specification.

## Merge order (staged integration)

`#42 → #53 → #54 → #55 → #56 → #57 → #58 → #59 → #60` into `lab4-staging`, each with a merge commit, then the release PR into `main`. Each feature branch was built on the previous one, so merging in this order produced no conflicts.

## Review checklist used

- [x] PR targets `lab4-staging` and closes its Issue
- [x] Code matches the numbered FR/BR/AC in `specification.md`
- [x] Backend enforces authorization (not only the UI)
- [x] New tests added and full suite green (server, client, E2E)
- [x] No console errors, placeholders or unrelated changes
