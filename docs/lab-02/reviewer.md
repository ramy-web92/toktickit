\# Lab 2 — Peer Review Log



\*\*Author\*\*: Rémy Fahs (ramy-web92)

\*\*Reviewer\*\*: amraneyanis2006-cmyk







\## PR #10 — docs(lab2): sprint specification, API/UI spec, test plan

\- \*\*Link\*\*: https://github.com/ramy-web92/toktickit/pull/11

\- \*\*Comment received\*\*: "Great work setting up the Lab 2 spec docs — the AC-to-test traceability

&#x20; table in tests.md makes it really easy to check coverage at a glance. Maybe add a short note in

&#x20; specification.md's Assumptions section explaining why ticketNumber (not id) is used in the URL,

&#x20; just so future readers don't wonder why."

\- \*\*My response\*\*: "Okay thank you very much" + added the URL identifier choice explanation to

&#x20; specification.md Section 11.

\- \*\*Status\*\*: ✅ Approved





\## PR #16 — feat(lab2): Development Requester context

\- \*\*Link\*\*: https://github.com/ramy-web92/toktickit/pull/16

\- \*\*Comment received\*\*: "Nice, this works well! One small thing: selectedId is typed number | "",

&#x20; you could default to 0 and check > 0 instead, a bit cleaner. Not blocking."

\- \*\*My response\*\*: "Yeah true, I'll leave it as-is for now since it works fine with the current

&#x20; seed data, but noted for a future cleanup."

\- \*\*Status\*\*: ✅ Approved



\## PR #17 — feat(lab2): Ticket creation

\- \*\*Link\*\*: https://github.com/ramy-web92/toktickit/pull/17

\- \*\*Comment received\*\*: "Good job, well done."

\- \*\*My response\*\*: "Thank you for your feedback."

\- \*\*Status\*\*: ✅ Approved



\## PR #18 — feat(lab2): My Tickets list with search, filters, pagination

\- \*\*Link\*\*: https://github.com/ramy-web92/toktickit/pull/18

\- \*\*Comment received\*\*: "Nice, the empty vs no-results distinction works well! One thing: the 

&#x20; hasEverHadTickets state feels a bit fragile since it's only updated when there are no active 

&#x20; filters — if a requester has tickets but you load the page with a filter already applied 

&#x20; somehow, could show the wrong message. Not urgent, just flagging."

\- \*\*My response\*\*: "Good catch, that's a fair edge case. For Lab 2 there's no way to arrive with 

&#x20; a pre-applied filter (filters always start empty on mount), so it doesn't trigger in practice, 

&#x20; but I'll keep it in mind if we add URL-based filter persistence later."

\- \*\*Status\*\*: ✅ Approved





