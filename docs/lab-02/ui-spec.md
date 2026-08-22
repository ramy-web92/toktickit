\# Lab 2 UI Specification — Zen Green Theme



\## 1. Color Tokens

| Token | Value | Usage |

|---|---|---|

| Primary green | #006B3C | App header, primary actions, strong emphasis |

| Secondary green | #0B7A46 | Active tabs, focus accents, links, hover states |

| Pale green | #EAF6EF | Selected, success, subtle section emphasis |

| Page background | #F5F7F6 | Page background |

| Surface/cards | White | Cards, with subtle border and restrained shadow |

| Text | Dark charcoal-green | Not pure black |

| Editable field | White background, neutral border | |

| Read-only field | Soft gray-green or warm ivory | Clearly distinct but readable |

| Error | Dark red text and border | Message below field |

| Warning | Amber callout/badge | Not decorative |

| Success | Green confirmation | Never color alone |



\## 2. Typography and Spacing

\- Font: system font stack (e.g. -apple-system, Segoe UI, Roboto).

\- Headings: bold, primary green (#006B3C).

\- Body text: charcoal-green, 14-16px.

\- Labels: above inputs, medium weight, consistent spacing (8px gap to control).

\- Section spacing: 24px between major form sections.



\## 3. Component States

\- \*\*Editable field\*\*: white background, neutral gray border, focus ring in secondary green.

\- \*\*Read-only field\*\*: soft gray-green background, no focus ring, cursor default.

\- \*\*Invalid field\*\*: red border, error text below field (not just color — includes icon/text).

\- \*\*Disabled control\*\*: reduced opacity, no hover/focus effect, cursor not-allowed.

\- \*\*Required field\*\*: red asterisk next to label (does not replace validation message).

\- \*\*Button hierarchy\*\*:

&#x20; - Primary: solid primary green background, white text.

&#x20; - Secondary: outline secondary green, green text.

&#x20; - Destructive (e.g. remove attachment): outline red, red text.

&#x20; - Disabled: gray background, no interaction.

&#x20; - Busy: spinner + disabled state while request is in flight.



\## 4. Application Shell

\- Header: TokTickIT title (left), My Tickets / Create Ticket nav (center), current Development

&#x20; Requester name + "Change Requester" action + Profile icon (right).

\- Active nav item underlined/highlighted in secondary green.

\- Mobile: nav collapses into a hamburger menu; Requester name still visible.



\## 5. Development Requester Selection Screen

\- Centered card, icon, title "Select Development Requester".

\- Explanatory text: "This is for testing only and is not a login screen."

\- Dropdown of active Requesters (name + email).

\- States: loading (spinner), empty (no active requesters — message + no dropdown), 

&#x20; error (safe retry message + Retry button).

\- Continue button (primary), disabled until a Requester is selected.



\## 6. Create Ticket Screen

\- Layout order (top to bottom): read-only system fields (Ticket Number placeholder, Ticket Date) →

&#x20; Category / Related System / Requested Priority (grouped) → Summary (full width) → 

&#x20; Description (full width, taller, resizable) → Attachments → Submit / Cancel buttons.

\- Read-only fields visually distinct (soft gray-green background).

\- Validation messages appear directly below each field on blur/submit.

\- Attachment area: drag-and-drop or file picker, list of selected files with size + remove (X) 

&#x20; before submit, inline error per rejected file (wrong type / too large).

\- Submit button shows spinner + "Submitting..." while in flight; disabled during request.

\- Success state: green confirmation banner showing the generated Ticket Number + 

&#x20; "View Ticket" / "Create Another" actions.



\## 7. My Tickets Screen

\- Top bar: search input (left), Category/Requested Priority/IT Priority/Status filter dropdowns,

&#x20; "Clear Filters" and "Create Ticket" buttons (right).

\- Table (desktop): Ticket No., Created Date, Summary, Category, Requested Priority (badge), 

&#x20; IT Priority (badge), Current Status (badge), Last Updated — sortable column headers.

\- Mobile: table collapses into stacked cards, same fields, tap to open detail.

\- Pagination: page numbers + Previous/Next, page size not user-configurable in Lab 2 (fixed at 10).

\- States: loading (skeleton rows), empty ("You haven't created any tickets yet" + Create Ticket CTA),

&#x20; no-results ("No tickets match your filters" + Clear Filters CTA), error (safe retry banner).



\## 8. Requester Ticket Detail Screen

\- Read-only field groups at top: Ticket No. / Date / Category / Related System (row 1), 

&#x20; Requester / Requested Priority / IT Priority / Current Status (row 2), Summary (full width), 

&#x20; Description (full width).

\- Attachments panel below, clearly separated (border/section header "Attachments"):

&#x20; - List of attachments: filename, size, upload date, Download button, Remove button.

&#x20; - Removed attachments shown grayed out with "Removed" badge and reason, no Download button.

&#x20; - Add Attachment button opens the same upload control as Create Ticket.

&#x20; - Soft-remove requires a confirmation dialog with a required reason text field.

\- No Public Comments, Internal Notes, Service Actions, or status-change controls present.



\## 9. Responsive Rules

| Viewport | Behavior |

|---|---|

| Desktop ≥992px | Multi-column layout, content max-width \~1200px, centered |

| Tablet 768-991px | Two-column layout where practical |

| Mobile <768px | Fields stack vertically, buttons full-width and touch-friendly, no horizontal scroll |



\## 10. Accessibility

\- Every input has a programmatic `<label>`.

\- Focus indicators visible (2px outline in secondary green) for keyboard navigation.

\- Icon-only controls (e.g. remove file X) have `aria-label` and tooltip.

\- Status/priority badges use text, not color alone.

\- Color contrast meets WCAG AA minimums against the Zen Green palette.



\## 11. Screenshot Checklist (for submission)

\- \[ ] Development Requester Selection: default, loading, empty, error

\- \[ ] Create Ticket: initial, validation error, submitting, success, API failure, invalid attachment

\- \[ ] My Tickets: populated, empty, no-results, filtered, paginated — desktop + mobile

\- \[ ] Ticket Detail: populated, attachment added, attachment soft-removed — desktop + mobile

