Lab 2 — AI Use and Reflection

I used Claude (Anthropic), used interactively throughout the sprint for specification drafting, code generation, debugging, and Git workflow guidance.

Key Prompts
"Explain step by step what this lab is asking me to do" Purpose: Understand the overall scope and goal of Lab 2 before starting.
"Help me write api-spec.md with full endpoint contracts" Purpose: Define the REST API request/response shapes and status codes before implementation.
"Help me design the Prisma schema for Ticket and Attachment, consistent with the existing Category model" Purpose: Extend the database schema while staying consistent with Lab 1 conventions (Int IDs, not UUID).
"Fix this Prisma validation error about missing opposite relation fields" Purpose: Debug a schema error when adding foreign key relations between Ticket, Category, RelatedSystem, and DevRequester.
"Help me build the Create Ticket form with validation, file upload, and success/error states" Purpose: Implement the CreateTicket React component matching the specification's business rules.
"Why does my newly added route return 'Cannot GET'?" Purpose: Debug a merge/edit mistake that accidentally removed the Express app initialization code.
"Help me resolve this Git merge conflict in app.ts between two feature branches" Purpose: Understand and manually resolve a merge conflict between the Ticket creation and My Tickets endpoints.
"Write API tests for the attachment soft-removal lifecycle using vitest and supertest" Purpose: Generate test coverage for creation, double-removal rejection, missing reason, and blocked download of removed attachments.

My Reflection

Working with an AI assistant sped up the specification-writing and boilerplate coding significantly, especially for repetitive patterns. The most useful part was going step by step rather than asking for everything at once — it forced me to actually read and understand what was being added instead of blindly copy-pasting a huge file. The AI was also very effective at diagnosing Git conflicts and PowerShell quoting issues, which would have taken me much longer to debug alone. I still had to verify every result myself before trusting it was correct.