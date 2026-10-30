// Lab 4 — pure business rules for Actions Taken (BR-07..BR-11).
// No database access here, so these rules are unit-testable (UNIT-03, UNIT-04).

export type ActionStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export const ACTION_LIMITS = {
  description: 2000,
  result: 2000,
  followUpNote: 1000,
  attachmentNotes: 500,
  idempotencyKey: 64,
} as const;

/** BR-09: tolerance for client/server clock differences. */
export const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/** BR-09: the UI date/time picker has minute precision. */
export const PICKER_PRECISION_MS = 60 * 1000;

/** BR-11: permitted Action Taken status transitions. COMPLETED and CANCELLED are final. */
export const ACTION_TRANSITIONS: Record<ActionStatus, ActionStatus[]> = {
  PLANNED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionAction(from: ActionStatus, to: ActionStatus): boolean {
  return ACTION_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isActionLocked(status: ActionStatus): boolean {
  return status === "COMPLETED" || status === "CANCELLED";
}

/** BR-13: Actions cannot be created or edited on a Closed or Cancelled Ticket. */
export function isTicketLockedForActions(ticketStatus: string): boolean {
  return ticketStatus === "CLOSED" || ticketStatus === "CANCELLED";
}

/** Normalized, validated Action fields (what is stored). */
export type ActionFields = {
  description: string;
  result: string | null;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  actionAt: Date;
};

export type FieldErrors = Record<string, string>;

function optionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Merges a request body onto the current values (for PATCH) or defaults (for create)
 * and validates the result. Unknown and server-controlled fields are ignored (BR-04, BR-05).
 */
export function validateActionFields(
  body: Record<string, unknown>,
  current: ActionFields,
  ctx: { ticketCreatedAt: Date; now: Date },
): { value: ActionFields; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const value: ActionFields = { ...current };

  // Description (BR-07)
  if (body.description !== undefined) {
    if (typeof body.description !== "string") {
      errors.description = "Description must be text.";
    } else {
      value.description = body.description.trim();
    }
  }
  if (!errors.description) {
    if (value.description.length === 0) errors.description = "Description is required.";
    else if (value.description.length > ACTION_LIMITS.description)
      errors.description = `Description must be at most ${ACTION_LIMITS.description} characters.`;
  }

  // Result (BR-07) — optional here, required only to complete
  const result = optionalText(body.result);
  if (body.result !== undefined && result === undefined) errors.result = "Result must be text.";
  else if (result !== undefined) value.result = result;
  if (!errors.result && value.result && value.result.length > ACTION_LIMITS.result)
    errors.result = `Result must be at most ${ACTION_LIMITS.result} characters.`;

  // Follow-up (BR-08)
  if (body.followUpRequired !== undefined) {
    if (typeof body.followUpRequired !== "boolean") errors.followUpRequired = "Follow-Up Required must be true or false.";
    else value.followUpRequired = body.followUpRequired;
  }
  const note = optionalText(body.followUpNote);
  if (body.followUpNote !== undefined && note === undefined) errors.followUpNote = "Follow-up Note must be text.";
  else if (note !== undefined) value.followUpNote = note;
  if (!value.followUpRequired) {
    value.followUpNote = null;
  } else if (!errors.followUpNote) {
    if (!value.followUpNote) errors.followUpNote = "Follow-up Note is required when follow-up is needed.";
    else if (value.followUpNote.length > ACTION_LIMITS.followUpNote)
      errors.followUpNote = `Follow-up Note must be at most ${ACTION_LIMITS.followUpNote} characters.`;
  }

  // Attachment Notes (BR-10)
  const attachmentNotes = optionalText(body.attachmentNotes);
  if (body.attachmentNotes !== undefined && attachmentNotes === undefined)
    errors.attachmentNotes = "Attachment Notes must be text.";
  else if (attachmentNotes !== undefined) value.attachmentNotes = attachmentNotes;
  if (!errors.attachmentNotes && value.attachmentNotes && value.attachmentNotes.length > ACTION_LIMITS.attachmentNotes)
    errors.attachmentNotes = `Attachment Notes must be at most ${ACTION_LIMITS.attachmentNotes} characters.`;

  // Action Date/Time (BR-09)
  if (body.actionAt !== undefined && body.actionAt !== null) {
    const parsed = typeof body.actionAt === "string" ? new Date(body.actionAt) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
      errors.actionAt = "Action Date/Time must be a valid date.";
    } else {
      value.actionAt = parsed;
    }
  }
  if (!errors.actionAt) {
    if (value.actionAt.getTime() > ctx.now.getTime() + FUTURE_TOLERANCE_MS)
      errors.actionAt = "Action Date/Time cannot be in the future.";
    // The date/time picker works in whole minutes, so allow up to 1 minute before
    // the Ticket's creation second (an action added right after creation must pass).
    else if (value.actionAt.getTime() < ctx.ticketCreatedAt.getTime() - PICKER_PRECISION_MS)
      errors.actionAt = "Action Date/Time cannot be before the Ticket was created.";
  }

  return { value, errors };
}

/** BR-07: a Result is required to complete an action. */
export function validateCompletion(result: string | null): FieldErrors {
  if (!result || result.trim().length === 0) return { result: "Result is required to complete an action." };
  return {};
}

/** Parses expectedVersion (BR-22). Returns null if missing or invalid. */
export function parseExpectedVersion(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 ? n : null;
}
