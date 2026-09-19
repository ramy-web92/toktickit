AI Use — Lab 3

AI used: Claude

Selected Key Prompts

1. Asking claude an explanation of the main objectives of the lab 

2. Course-correction that shifted the whole session to a strictly incremental, one-command-at-a-time workflow for the rest of the lab.

3. Asked the AI to recommend and justify an authentication mechanism given the course security lecture and the lab's exclusion 

4. Prompt requesting the full session-based auth implementation (login/logout/current-user/change-password) with express-session and bcryptjs, including generic error messages per BR-06/BR-07.

5. Prompt requesting the IT Staff Ticket Queue and Ticket Detail backend, including the status transition matrix (BR-13) and the Public Comments / Internal Notes split (BR-04).

6. Prompt requesting the Administrator user management backend, specifically the self-deactivation (BR-15) and last-active-Administrator (BR-16) safety rules.

7. Debugging prompt when `npx prisma migrate dev` failed with a foreign-key violation (P3018) — asked the AI to diagnose and propose a safe recovery path without losing data.

8. Debugging prompt when automated tests intermittently failed with a 500 error on ticket creation — the AI diagnosed a race condition from Vitest running test files in parallel against a shared database and proposed `fileParallelism: false`.

9. Clarified how backend and frontend work for the same feature should map to GitHub Issues, correcting an earlier suggestion to create duplicate Issues.


## My Reflection

## My Reflection

Using Claude as a specification and coding agent helped me understand the actual goals of Lab 3, not just execute commands blindly. Early on I let it move too fast (multiple files, multiple concepts per message), which I couldn't follow or verify — asking it to slow down and go step by step, one file or one command at a time, made a real difference. Explaining each piece before moving to the next helped me actually understand what authentication, authorization, and ownership checks were supposed to do, and why, instead of just copy-pasting code I didn't fully grasp.
The AI was genuinely useful for catching security-relevant edge cases I wouldn't have thought of myself (the last-Administrator protection, the identical error message for wrong-password vs. inactive-account, the ownership check using session identity instead of a client-supplied ID) and for diagnosing two non-obvious bugs (a partially-applied failed Prisma migration, and a test race condition from parallel file execution against a shared database). It was less reliable when it came to my own GitHub workflow — I had to correct it more than once when it suggested creating duplicate Issues. Overall, going through the lab step by step with explanations at each stage helped me connect the individual tasks (auth, roles, ticket ownership, admin safety rules) back to the bigger picture of what the sprint was actually trying to achieve.