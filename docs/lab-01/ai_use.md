# Lab 1 — AI Use and Reflection

I used Claude (Anthropic) as my AI assistant throughout Lab 1, mainly for guidance on the Git workflow, debugging errors, and generating the code for each Issue.

## Selected Key Prompts

| Prompt Name | Actual Prompt Text | My Reflection |
|---|---|---|
| Understand the assignment | Explained the Lab 1 requirements and asked for a summary of the four Issues and workflow | Very helpful to get an overview before starting, since this was my first real Git/GitHub workflow project |
| Environment setup | Asked for step-by-step help installing Node.js, Git, and PostgreSQL on Windows | Needed several follow-ups (execution policy error, PATH issues) but got it working |
| Git branch workflow | Asked how to create the lab1-staging branch and feature branches correctly | Worked well once I understood to always branch from lab1-staging, not main |
| Implement health check | Asked for the code to make GET /api/health return the required 200 JSON response | Worked in one shot |
| Prisma Category model and seed | Asked for the Category model, migration, and an idempotent seed | Had to fix a schema syntax error before it worked |
| Implement category list feature | Asked for the GET /api/categories endpoint and the React code to display it | Needed a follow-up fix after accidentally pasting test code into the wrong file |
| Write Vitest UI tests | Asked how to test the Online/Offline UI states using mocked API calls | Learned how to use vi.spyOn to mock a module for testing |

## Reflection

This was the first time I used GitHub and a real Git workflow (branches, Pull Requests, Issues, peer review). At the beginning it felt complicated, especially understanding the difference between main, lab1-staging, and feature branches, and getting comfortable with the terminal commands. With Claude's help, explaining each step before running it, I progressively understood how the whole workflow fits together: why we branch, why we open Pull Requests, and why peer review matters.

By the end of the lab, I feel like I properly understood how GitHub works, not just followed instructions blindly. I think this will be very useful going forward, since GitHub is a powerful tool and I now know how to use it to host and manage all my future projects properly.