# Lab 3 Test Plan — TokTickIT

Test plan written before/alongside implementation. Every Acceptance
Criterion in `specification.md` maps to at least one row below.

## Authentication

| Test ID | Type | AC | What It Tests | Expected Result | Automated Test File | Status |
|---|---|---|---|---|---|---|
| API-01 | API | AC-01 | Valid login | Session created; returns id/name/role, no password hash | server/tests/lab-03/auth.api.test.ts | Pass |
| API-02 | API | AC-05 | Login with wrong password | Generic "Invalid email or password" | server/tests/lab-03/auth.api.test.ts | Pass |
| API-03 | API | AC-05 | Login with unknown email | Same generic error as API-02 | server/tests/lab-03/auth.api.test.ts | Pass |
| API-04 | API | AC-05 | Login on inactive account (correct password) | Same generic error, no hint account exists | server/tests/lab-03/auth.api.test.ts | Pass |
| API-05 | API | AC-10 | Logout then call protected endpoint | 401 Unauthenticated | server/tests/lab-03/auth.api.test.ts | Pass |
| API-06 | API | AC-02 | Current-user while mustChangePassword=true | Flag returned; app screens blocked until changed | server/tests/lab-03/auth.api.test.ts | Pass |
| UNIT-01 | Unit | BR-08 | Password hashing | Hash differs from plaintext; same password → different hash (salt) | server/tests/lab-03/auth.api.test.ts | Pass |
| E2E-01 | E2E | AC-01 | Valid login via UI | Redirects to role home screen | e2e/lab-03/authentication.spec.ts | Planned |
| E2E-02 | E2E | AC-02 | Initial password login and change | Normal app opens only after valid change | e2e/lab-03/authentication.spec.ts | Planned |
| E2E-03 | E2E | AC-10 | Logout then back-button/direct URL | Redirected to /login | e2e/lab-03/authentication.spec.ts | Planned |

## Authorization & Ownership

| Test ID | Type | AC | What It Tests | Expected Result | Automated Test File | Status |
|---|---|---|---|---|---|---|
| API-07 | API | AC-03 | Requester supplies another requesterId | Backend ignores it, uses session identity | server/tests/lab-03/authorization.api.test.ts | Pass |
| API-08 | API | AC-04 | Requester requests Internal Notes endpoint | 403 Forbidden; no note content returned | server/tests/lab-03/authorization.api.test.ts | Pass |
| API-09 | API | - | IT Staff calls Administrator user-list endpoint | 403 Forbidden | server/tests/lab-03/authorization.api.test.ts | Pass |
| API-10 | API | - | Requester calls IT Staff queue endpoint | 403 Forbidden | server/tests/lab-03/authorization.api.test.ts | Pass |
| API-11 | API | - | Unauthenticated request to any protected endpoint | 401 Unauthenticated | server/tests/lab-03/authorization.api.test.ts | Pass |
| API-12 | API | - | Requester requests another Requester's ticket by ID | 403/404 without leaking existence | server/tests/lab-03/authorization.api.test.ts | Pass |

## IT Staff Ticket Queue

| Test ID | Type | What It Tests | Expected Result | Automated Test File | Status |
|---|---|---|---|---|---|
| API-13 | API | Queue search by ticket number/summary | Filtered results returned | server/tests/lab-03/staff-queue.api.test.ts | Pass |
| API-14 | API | Queue filter by status/category/owner | Correct subset returned | server/tests/lab-03/staff-queue.api.test.ts | Pass |
| API-15 | API | Queue sort by priority/date | Correctly ordered results | server/tests/lab-03/staff-queue.api.test.ts | Pass |
| API-16 | API | Queue pagination | Correct page + metadata | server/tests/lab-03/staff-queue.api.test.ts | Pass |
| API-17 | API | Invalid query parameter | Safe 400 error, not server crash | server/tests/lab-03/staff-queue.api.test.ts | Pass |
| UI-01 | UI Component | Queue table renders | Columns, badges display correctly | client/.../lab-03 tests/StaffTicketQueue.test.tsx | Planned |
| UI-02 | UI Component | Empty/no-results state | Friendly message shown | client/.../lab-03 tests/StaffTicketQueue.test.tsx | Planned |
| RESP-01 | Responsive | Queue on mobile width | Collapses to stacked cards | manual/screenshot: artifacts/lab-03/screenshots/staff-queue | Pass |

## IT Staff Ticket Detail (ownership, priority, status, comments, notes)

| Test ID | Type | AC | What It Tests | Expected Result | Automated Test File | Status |
|---|---|---|---|---|---|---|
| API-18 | API | AC-08 | Claim unassigned ticket | ownerId set to current IT Staff user | server/tests/lab-03/staff-ticket-detail.api.test.ts | Pass |
| API-19 | API | - | Reassign owned ticket | ownerId updated to new IT Staff user | server/tests/lab-03/staff-ticket-detail.api.test.ts | Pass |
| API-20 | API | - | Set IT Priority | Value updated; Requested Priority unchanged | server/tests/lab-03/staff-ticket-detail.api.test.ts | Pass |
| API-21 | API | AC-09 | Requester attempts Resolved/Closed transition | Rejected (403) | server/tests/lab-03/staff-ticket-detail.api.test.ts | Pass |
| API-22 | API | - | IT Staff attempts invalid status transition | Rejected (400/409) | server/tests/lab-03/staff-ticket-detail.api.test.ts | Pass |
| API-23 | API | - | Post Public Comment | Comment stored with author + timestamp | server/tests/lab-03/comments-notes.api.test.ts | Pass |
| API-24 | API | - | Post empty/whitespace comment | Rejected (400) | server/tests/lab-03/comments-notes.api.test.ts | Pass |
| API-25 | API | - | Post Internal Note as IT Staff | Note stored, not visible to Requester | server/tests/lab-03/comments-notes.api.test.ts | Pass |
| UI-03 | UI Style | - | Internal Notes visually distinct from Public Comments | Different background/label confirmed | client/.../lab-03 tests/StaffTicketDetail.test.tsx | Planned |
| E2E-04 | E2E | - | Full IT Staff flow: claim → set priority → comment → resolve | Ticket state reflects all changes | e2e/lab-03/staff-ticket-flow.spec.ts | Planned |

## Administrator User Management

| Test ID | Type | AC | What It Tests | Expected Result | Automated Test File | Status |
|---|---|---|---|---|---|---|
| API-26 | API | - | List users | Returns Name/Email/Role/Status | server/tests/lab-03/users-admin.api.test.ts | Pass |
| API-27 | API | - | Search users by name/email | Filtered results | server/tests/lab-03/users-admin.api.test.ts | Pass |
| API-28 | API | - | Filter users by role | Filtered results | server/tests/lab-03/users-admin.api.test.ts | Pass |
| API-29 | API | - | Create user with valid data | User created, initial password set, mustChangePassword=true | server/tests/lab-03/users-admin.api.test.ts | Pass |
| API-30 | API | BR-10 | Create user with duplicate email | 409 Conflict | server/tests/lab-03/users-admin.api.test.ts | Pass |
| API-31 | API | - | Create user with invalid role value | 400 Bad Request | server/tests/lab-03/users-admin.api.test.ts | Pass |
| API-32 | API | - | Edit user's name/email/role/activation | Fields updated | server/tests/lab-03/users-admin.api.test.ts | Pass |
| API-33 | API | - | Set new initial password | mustChangePassword=true for that user | server/tests/lab-03/users-admin.api.test.ts | Pass |
| API-34 | API | AC-06 | Admin attempts to deactivate own account | Rejected | server/tests/lab-03/users-admin.api.test.ts | Pass |
| API-35 | API | AC-07 | Deactivate/reassign role of last active Administrator | Rejected | server/tests/lab-03/users-admin.api.test.ts | Pass |
| API-36 | API | - | Non-Administrator calls any admin endpoint | 403 Forbidden | server/tests/lab-03/users-admin.api.test.ts | Pass |
| UI-04 | UI Component | - | User Management list + create/edit panel render | Fields and validation states shown | client/.../lab-03 tests/UserManagement.test.tsx | Pass |
| E2E-05 | E2E | - | Full admin flow: create user → login as user → forced password change | End-to-end works as specified | e2e/lab-03/user-administration.spec.ts | Planned |

## Migration & Regression

| Test ID | Type | What It Tests | Expected Result | Automated Test File | Status |
|---|---|---|---|---|---|
| MIG-01 | Migration | Development Requester → User migration | All existing tickets retain correct requesterId | server/tests/lab-03/auth.api.test.ts | Pass |
| REG-01 | Regression | Lab 2 Requester create/view/edit ticket flows | All still pass under authenticated identity | server/tests/lab-03/authorization.api.test.ts | Pass |
| REG-02 | Regression | Lab 2 Attachment upload/download | Still works, ownership enforced | server/tests/lab-03/authorization.api.test.ts | Pass |

## Accessibility & Safe Failures

| Test ID | Type | What It Tests | Expected Result | Automated Test File | Status |
|---|---|---|---|---|---|
| A11Y-01 | Accessibility | Keyboard navigation on Login/Change Password | All fields reachable via Tab, visible focus | manual checklist | Planned |
| FAIL-01 | Failure | Backend unreachable during login | Safe error banner, no stack trace shown | e2e/lab-03/authentication.spec.ts | Planned |
| FAIL-02 | Failure | Backend 500 on Queue fetch | Safe error banner, retry option | client/.../lab-03 tests/StaffTicketQueue.test.tsx | Planned |