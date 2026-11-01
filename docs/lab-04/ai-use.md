# TokTickIT — Sprint 4 AI Use

## LLM used

- **Claude Opus 5.5** (Anthropic), in the claude.ai chat interface, used both as the **specification agent** and as the **coding agent**.
- Prompts were written in French; they are translated and shortened below.
- The AI could read the public repository (`ramy-web92/toktickit`) to match the existing Lab 1–3 code. It could not run PostgreSQL migrations through Prisma or a browser itself, so every migration, test suite and E2E run was executed on my machine and the results were sent back to it.

## How the agents were used

| Step | Agent role | What I did |
|---|---|---|
| Engineering contract | Specification agent | Shared the Lab 4 handout, reviewed and accepted the design choices (assignee + status on Actions Taken, resolution gate, version-based concurrency), merged the spec before any code |
| Issues and workflow | Specification agent | Created the 10 GitHub Issues, placed them on the Kanban, opened one PR per Issue to `lab4-staging` |
| Implementation | Coding agent | Applied each increment on its own feature branch, ran the tests locally, checked the screens in the browser, pushed and opened the PR |
| Hardening | Coding agent | Ran the E2E/axe suites, reported the failures, applied the fixes and re-ran everything |

## Selected key prompts

| # | Prompt (translated / shortened) | Result |
|---|---|---|
| 1 | "Here is my Lab 4 handout [PDF]. Help me with everything: start with the spec." | Draft `specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md` with FR/BR/AC numbering and traceability |
| 2 | "Give me the GitHub Issues to create." | 10 Issues with scope, AC, tests and branch names (#43–#52) |
| 3 | "Here is my repository — make the spec match my Lab 3 code before coding." | Spec v1.1: int ids, `ADMINISTRATOR`, `currentStatus`, Lab 3 transition matrix kept |
| 4 | "Do issue #44: migration, backfill, rollback and seed." | Prisma migration + backfill, rollback script, idempotent seed, MIG/SEED tests |
| 5 | "17 tests fail after the seed, here is the output." | Root cause: seed ticket numbers collided with test tickets, and Lab 2–3 tests used a password changed by hand; both fixed |
| 6 | "Next issue: Actions Taken API, then the workflow." | Routes with authorization, validation, `expectedVersion` (409) and `Idempotency-Key`; resolution gate and status history |
| 7 | "Next: dashboards." | Dashboard APIs sharing the same filters as the lists; every metric compared with raw SQL (API-26) |
| 8 | "Now the UI for Actions Taken / workflow / dashboards." | React components + component tests (UI-01..UI-14), role navigation and drill-down |
| 9 | "Last one: final hardening and regression." | Polish, accessible labels, Lab 1/Lab 3 tests repaired, E2E + responsive + axe suites, README |
| 10 | "4 E2E tests fail, here is the output." | Found a real bug (minute-precision date picker vs. Ticket creation second) and a missing select label; both fixed, 30/30 E2E pass |

The AI also suggested review questions for each PR; my reviewer chose which ones to ask and wrote the approvals.

## Problems the AI got wrong or that I had to catch

- The first spec assumed UUIDs and an `ADMIN` role; reading the real Lab 3 schema forced a v1.1.
- Seed ticket numbers collided with tickets created by the Lab 2 tests (fixed with a reserved 9000xx range, then `highest + 1` numbering).
- The action date validation rejected actions created in the same minute as the Ticket — only the E2E tests revealed it.
- Commands written for bash (`&&`) did not work in Windows PowerShell; I had to run them one by one.

## My Reflection

Writing and merging the specification before any code changed the result more than I expected. When the AI read my Lab 3 code, the first draft of the spec turned out to assume things that were not true (UUIDs, an `ADMIN` role, a different status matrix); fixing that on paper in v1.1 was much cheaper than discovering it in the middle of a migration, and it kept the Lab 3 regression tests green.

The tests caught problems that I would not have seen by clicking through the UI. The seed test showed that my seed tickets were silently skipped because their numbers collided with tickets created by earlier tests, and the end-to-end tests revealed that an action added right after creating a Ticket was rejected because the date picker only has minute precision. Comparing every dashboard number with a raw SQL query also gave me real evidence instead of "it looks right".

The AI was a fast specification and coding agent, but it was not always right: it guessed names before seeing my schema, it wrote commands that do not work in PowerShell, and it could not run the database or a browser, so I had to run every migration and test suite myself and send back the real output. Treating its code as a proposal that has to pass my tests, not as a final answer, was the most important habit.

Next sprint I would merge each PR as soon as it is approved instead of stacking nine branches and merging at the end: stacking worked, but every review change would have had to be carried through all later branches, and it makes the integration look less incremental than it really was.
