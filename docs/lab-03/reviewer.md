# Reviewer Log — Lab 3

**Reviewer:** amraneyanis2006-cmyk

All Lab 3 pull requests were reviewed by the same peer reviewer before merge into `lab3-staging`.

## PR #21 — feat(lab-03): specification, DB migration, and session authentication

**Comment:** Nice, the login logic looks solid. Just double check that failed logins always show the same error message, even for inactive accounts. Approving!

**Response:** Thanks! Yep, tested it — same generic error every time.

**Status:** Approved and merged.

## PR #29 — feat(lab-03): IT Staff Ticket Queue and ticket operations

**Comment:** The status transition matrix is a nice touch, and the Internal Notes/Public Comments split looks correct. Just curious — what happens if someone sends an invalid status value entirely (not just a wrong transition)? LGTM either way, approving.

**Response:** Good question — it falls into the `allowedNextStatuses.includes()` check, so it gets rejected the same way as an invalid transition. Thanks!

**Status:** Approved and merged.

## PR #30 — feat(lab-03): Administrator user management

**Comment:** Good job protecting the last admin and blocking self-deactivation — those are easy to forget. Approving!

**Response:** Thanks! Yeah those two felt like the trickiest edge cases to get right.

**Status:** Approved and merged.

## PR #32 — feat(lab-03): Login, Change Password, and authenticated App Shell

**Comment:** Login and change-password flow work smoothly. One nitpick — placeholders for IT Staff/Admin views are a good temporary touch. Approving!

**Response:** Thanks! Yeah those placeholders will get replaced once the Queue/Admin UIs are built.

**Status:** Approved and merged.

## PR #33 — feat(lab-03): Requester Public Comments and Problem Appears Resolved

**Comment:** Nice, the resolved badge instead of a status change is exactly right per BR-05. Approving!

**Response:** Thanks! Wanted to make sure it didn't look like a real status change to the Requester.

**Status:** Approved and merged.

## PR #34 — feat(lab-03): IT Staff Ticket Queue and Ticket Detail UI

**Status:** Reviewed and merged (completes the frontend originally tracked under #23).

## PR #35 — feat(lab-03): Administrator User Management UI

**Comment:** The self-deactivation and last-admin warnings in the edit panel are a nice UX touch — much clearer than just a silent rejection. Approving!

**Response:** Thanks! Wanted the UI to explain why the fields are locked instead of just failing silently on submit.

**Status:** Approved and merged (completes the frontend originally tracked under #25).

## PR #36 — test(lab-03): E2E testing and visual inspection

**Comment:** 66 tests is solid coverage. Good catch on the parallelism race condition — that's a subtle bug to spot. Approving!

**Response:** Thanks! That one took a bit of debugging, the error message wasn't obvious at first.

**Status:** Approved and merged. Closes #27.

## PR #37 — docs(lab-03): update test plan with final pass/planned status

**Comment:** Good to keep the UI/E2E rows as Planned instead of overstating coverage — accurate traceability matters here. Approving!

**Response:** Thank you

**Status:** Approved and merged.

## PR #38 — docs(lab-03): AI use documentation

**Status:** Reviewed and merged.