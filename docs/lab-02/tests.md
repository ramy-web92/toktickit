\# Lab 2 Test Plan and Results



\## 1. Test Strategy

Tests are planned from `specification.md` before implementation (Test DD), then written as failing

tests before the corresponding feature is implemented (TDD). Coverage spans unit, API/integration,

UI component, UI style/responsive, and end-to-end (E2E) levels. Every Acceptance Criterion (AC-01 to

AC-14) maps to at least one automated test below.



\## 2. Planned Tests



| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |

|---|---|---|---|---|---|---|

| UNIT-01 | Unit | BR-01 | Ticket number generator format | Returns `TKT-YYYY-NNNNNN` | server/tests/lab-02/ticketNumber.unit.test.ts | Pending |

| UNIT-02 | Unit | BR-17/18 | Summary/Description length validators | Rejects out-of-range strings | server/tests/lab-02/validation.unit.test.ts | Pending |

| API-01 | API | AC-01 | Create valid ticket | 201; ticket saved; number returned | server/tests/lab-02/create-ticket.api.test.ts | Pending |

| API-02 | API | AC-04, BR-17 | Create ticket with short summary | 422; field error; no ticket saved | server/tests/lab-02/create-ticket.api.test.ts | Pending |

| API-03 | API | BR-22 | Create ticket, simulated DB failure | 500; no partial ticket persisted | server/tests/lab-02/create-ticket.api.test.ts | Pending |

| API-04 | API | AC-03, BR-12 | Requester B fetches Requester A's ticket | 404 TICKET\_NOT\_FOUND | server/tests/lab-02/ticket-detail.api.test.ts | Pending |

| API-05 | API | AC-12, BR-08 | List tickets for Requester A then B | Each sees only their own tickets | server/tests/lab-02/my-tickets.api.test.ts | Pending |

| API-06 | API | AC-10, BR-13/14 | Search/filter with no matches | Empty array; totalItems 0 | server/tests/lab-02/my-tickets.api.test.ts | Pending |

| API-07 | API | BR-15/16 | Sort and pagination defaults | Default sort createdAt desc; pageSize 10 | server/tests/lab-02/my-tickets.api.test.ts | Pending |

| API-08 | API | AC-05, BR-25 | Upload 6MB attachment | 413 FILE\_TOO\_LARGE | server/tests/lab-02/attachments.api.test.ts | Pending |

| API-09 | API | AC-06, BR-26 | Add 6th attachment to a ticket with 5 active | 409 ATTACHMENT\_LIMIT\_REACHED | server/tests/lab-02/attachments.api.test.ts | Pending |

| API-10 | API | BR-24 | Upload disallowed file type (.exe) | 415 UNSUPPORTED\_FILE\_TYPE | server/tests/lab-02/attachments.api.test.ts | Pending |

| API-11 | API | AC-07, BR-27/28 | Soft-remove attachment with reason | 200; isRemoved true; metadata retained | server/tests/lab-02/attachments.api.test.ts | Pending |

| API-12 | API | AC-08, BR-27 | Download a removed attachment | 410 ATTACHMENT\_REMOVED | server/tests/lab-02/attachments.api.test.ts | Pending |

| API-13 | API | BR-31 | Inactive requester attempts ticket creation | Rejected / not listed in selector | server/tests/lab-02/dev-requesters.api.test.ts | Pending |

| API-14 | API | BR-09 | No active requesters exist | Empty array returned, not an error | server/tests/lab-02/dev-requesters.api.test.ts | Pending |

| UI-01 | UI | AC-04 | Submit Create Ticket with empty Summary | Field message shown; API not called | client/src/.../CreateTicket.test.tsx | Pending |

| UI-02 | UI | BR-20 | Submit button state during request | Busy state; disabled; no double submit | client/src/.../CreateTicket.test.tsx | Pending |

| UI-03 | UI | AC-11 | Backend unreachable on submit | Safe error shown; field values preserved | client/src/.../CreateTicket.test.tsx | Pending |

| UI-04 | UI | AC-09 | My Tickets with zero tickets | Empty state shown, not no-results | client/src/.../MyTickets.test.tsx | Pending |

| UI-05 | UI | AC-10 | My Tickets with filters matching nothing | No-results state + Clear Filters button | client/src/.../MyTickets.test.tsx | Pending |

| UI-06 | UI | AC-14 | Requester selector with zero active requesters | Empty state shown | client/src/.../RequesterSelect.test.tsx | Pending |

| UI-07 | UI | BR-27 | Ticket Detail shows removed attachment | Grayed out, no download link, reason shown | client/src/.../RequesterTicketDetail.test.tsx | Pending |

| STYLE-01 | UI Style | Section 7 ui-spec | Zen Green tokens applied to buttons/badges | Matches approved color tokens | client/src/.../ZenGreen.style.test.tsx | Pending |

| RESP-01 | Responsive | AC-13 | Create Ticket at mobile viewport | No clipped labels, no horizontal scroll | e2e/lab-02/responsive.spec.ts | Pending |

| RESP-02 | Responsive | AC-13 | My Tickets table → card view at mobile | Cards render correctly, all fields visible | e2e/lab-02/responsive.spec.ts | Pending |

| E2E-01 | E2E | AC-01, AC-05 | Full ticket creation with valid attachment | Confirmation shows official Ticket Number | e2e/lab-02/create-ticket.spec.ts | Pending |

| E2E-02 | E2E | AC-12 | Switch Requester A → B in My Tickets | List updates to show only B's tickets | e2e/lab-02/requester-switch.spec.ts | Pending |

| E2E-03 | E2E | AC-07, AC-08 | Add then soft-remove an attachment | Attachment shows removed, download blocked | e2e/lab-02/attachment-lifecycle.spec.ts | Pending |



\## 3. Acceptance-Criterion Traceability

| AC | Covered by |

|---|---|

| AC-01 | API-01, E2E-01 |

| AC-02 | (selector redirect — to add: UI test on route guard) |

| AC-03 | API-04 |

| AC-04 | API-02, UI-01 |

| AC-05 | API-08, E2E-01 |

| AC-06 | API-09 |

| AC-07 | API-11, E2E-03 |

| AC-08 | API-12, E2E-03 |

| AC-09 | UI-04 |

| AC-10 | API-06, UI-05 |

| AC-11 | UI-03 |

| AC-12 | API-05, E2E-02 |

| AC-13 | RESP-01, RESP-02 |

| AC-14 | API-14, UI-06 |



\## 4. Responsive and Visual Checklist

\- \[ ] No clipped labels at any breakpoint (desktop/tablet/mobile)

\- \[ ] No unintended horizontal scrolling

\- \[ ] Read-only vs editable field styling consistent across all 3 screens

\- \[ ] Badge colors match Zen Green tokens, text included (not color-only)

\- \[ ] Focus indicators visible when tabbing through forms

\- \[ ] Screenshots captured and stored in `artifacts/lab-02/screenshots/`



\## 5. Test Commands

```bash

cd server \&\& npm test

cd client \&\& npm test

npx playwright test e2e/lab-02

```



\## 6. Final Results

\_To be filled in once tests are implemented and passing on `main`.\_



\## 7. Known Limitations or Deferred Tests

\- Performance/load testing not covered in Lab 2 (out of scope per handout).

\- Security/penetration testing deferred until authentication exists in Lab 3.

