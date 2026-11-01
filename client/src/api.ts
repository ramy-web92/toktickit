const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export async function checkSystem(): Promise<SystemStatus> {
  const healthRes = await fetch(`${API_URL}/api/health`);
  if (!healthRes.ok) {
    throw new Error("Backend is unavailable");
  }

  const categoriesRes = await fetch(`${API_URL}/api/categories`);
  if (!categoriesRes.ok) {
    throw new Error("Unable to load categories");
  }

  const categories: Category[] = await categoriesRes.json();
  return { online: true, categories };
}

export interface DevRequester {
  id: number;
  name: string;
  email: string;
}

export async function getDevRequesters(): Promise<DevRequester[]> {
  const res = await fetch(`${API_URL}/api/dev-requesters`);
  if (!res.ok) {
    throw new Error("Unable to load development requesters");
  }
  return res.json();
}

export interface RelatedSystem {
  id: number;
  name: string;
}

export interface Ticket {
  id: number;
  ticketNumber: string;
  summary: string;
  description: string;
  requestedPriority: string;
  itPriority: string;
  currentStatus: string;
  createdAt: string;
}

export async function getRelatedSystems(): Promise<RelatedSystem[]> {
  const res = await fetch(`${API_URL}/api/related-systems`);
  if (!res.ok) {
    throw new Error("Unable to load related systems");
  }
  return res.json();
}

export interface CreateTicketInput {
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: string;
  attachments: File[];
}

export interface CreateTicketResult {
  ticket: Ticket;
  attachmentResults: { fileName: string; status: string; reason?: string }[];
}

export async function createTicket(input: CreateTicketInput): Promise<CreateTicketResult> {
  const formData = new FormData();
  formData.append("requesterId", String(input.requesterId));
  formData.append("categoryId", String(input.categoryId));
  formData.append("relatedSystemId", String(input.relatedSystemId));
  formData.append("summary", input.summary);
  formData.append("description", input.description);
  formData.append("requestedPriority", input.requestedPriority);
  input.attachments.forEach((file) => formData.append("attachments", file));

  const res = await fetch(`${API_URL}/api/tickets`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw { status: res.status, ...data };
  }
  return data;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
  mustChangePassword: boolean;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw { status: res.status, ...data };
  }
  return data;
}

export async function logout(): Promise<void> {
  await fetch(`${API_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

export async function getCurrentUser(): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/api/auth/me`, {
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) {
    throw { status: res.status, ...data };
  }
  return data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/auth/change-password`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw { status: res.status, ...data };
  }
}

export interface PublicCommentData {
  id: number;
  content: string;
  createdAt: string;
  author: { name: string; role: string };
}

export async function getComments(ticketId: number): Promise<PublicCommentData[]> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/comments`, {
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data.comments;
}

export async function postComment(ticketId: number, content: string): Promise<PublicCommentData> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/comments`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data.comment;
}

export async function markResolvedByRequester(ticketId: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/resolved-by-requester`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json();
    throw { status: res.status, ...data };
  }
}

export interface StaffTicketRow {
  id: number;
  ticketNumber: string;
  createdAt: string;
  summary: string;
  requestedPriority: string;
  itPriority: string;
  currentStatus: string;
  updatedAt: string;
  category: { name: string };
  owner: { id: number; name: string } | null;
}

export interface StaffQueueResult {
  data: StaffTicketRow[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

export async function getStaffTickets(params: {
  page?: number;
  search?: string;
  status?: string;
  owner?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}): Promise<StaffQueueResult> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.owner) query.set("owner", params.owner);
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.sortDir) query.set("sortDir", params.sortDir);

  const res = await fetch(`${API_URL}/api/staff/tickets?${query.toString()}`, {
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

export interface StaffTicketDetailData {
  id: number;
  ticketNumber: string;
  summary: string;
  description: string;
  requestedPriority: string;
  itPriority: string;
  currentStatus: string;
  requesterMarkedResolved: boolean;
  requesterMarkedResolvedAt?: string | null;
  version: number;
  allowedTransitions?: string[];
  resolvedAt?: string | null;
  closedAt?: string | null;
  category: { name: string };
  relatedSystem: { name: string };
  requester: { id: number; name: string };
  owner: { id: number; name: string } | null;
  attachments: { id: number; originalFileName: string; sizeBytes: number; isRemoved: boolean }[];
}

export async function getStaffTicketDetail(ticketId: number): Promise<StaffTicketDetailData> {
  const res = await fetch(`${API_URL}/api/staff/tickets/${ticketId}`, {
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data.ticket;
}

export async function claimOrReassignTicket(ticketId: number, ownerId: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/owner`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownerId }),
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
}

export async function setItPriority(ticketId: number, itPriority: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/priority`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itPriority }),
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
}

export async function setTicketStatus(ticketId: number, status: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/status`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
}

export interface InternalNoteData {
  id: number;
  content: string;
  createdAt: string;
  author: { name: string; role: string };
}

export async function getInternalNotes(ticketId: number): Promise<InternalNoteData[]> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/notes`, {
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data.notes;
}

export async function postInternalNote(ticketId: number, content: string): Promise<InternalNoteData> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/notes`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data.note;
}

export interface AdminUserRow {
  id: number;
  name: string;
  email: string;
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
  isActive: boolean;
}

export async function getAdminUsers(params: { search?: string; role?: string }): Promise<AdminUserRow[]> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.role) query.set("role", params.role);

  const res = await fetch(`${API_URL}/api/admin/users?${query.toString()}`, {
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data.users;
}

export async function createAdminUser(input: {
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  initialPassword: string;
}): Promise<AdminUserRow> {
  const res = await fetch(`${API_URL}/api/admin/users`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data.user;
}

export async function updateAdminUser(
  id: number,
  input: Partial<{ name: string; email: string; role: string; isActive: boolean }>
): Promise<AdminUserRow> {
  const res = await fetch(`${API_URL}/api/admin/users/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data.user;
}

export async function resetAdminUserPassword(id: number, newInitialPassword: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/users/${id}/reset-password`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newInitialPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
}

export async function getStaffUsers(): Promise<AdminUserRow[]> {
  const res = await fetch(`${API_URL}/api/admin/users?role=IT_STAFF`, {
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data.users;
}

export async function getAdminUsersList(): Promise<AdminUserRow[]> {
  const res = await fetch(`${API_URL}/api/admin/users?role=ADMINISTRATOR`, {
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data.users;
}
// ---------------------------------------------------------------------------
// Lab 4 — Actions Taken (docs/lab-04/api-spec.md)

/** Error thrown by Lab 4 API helpers: HTTP status + the server's error body. */
export interface ApiError {
  status: number;
  error?: { code?: string; message?: string; details?: any };
}

async function lab4Json<T>(res: Response): Promise<T> {
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) throw { status: res.status, ...(data ?? {}) } as ApiError;
  return data as T;
}

export type ActionStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface ActionTakenData {
  id: number;
  ticketId: number;
  actionAt: string;
  description: string;
  result: string | null;
  status: ActionStatus;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  createdBy: { id: number; name: string };
  assignee: { id: number; name: string };
  performedBy: { id: number; name: string } | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActionInput {
  actionAt?: string;
  description?: string;
  result?: string | null;
  assigneeId?: number;
  followUpRequired?: boolean;
  followUpNote?: string | null;
  attachmentNotes?: string | null;
}

export async function getActions(ticketId: number): Promise<ActionTakenData[]> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/actions`, { credentials: "include" });
  return (await lab4Json<{ items: ActionTakenData[] }>(res)).items;
}

export async function createAction(ticketId: number, input: ActionInput, idempotencyKey: string): Promise<ActionTakenData> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/actions`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(input),
  });
  return lab4Json<ActionTakenData>(res);
}

export async function updateAction(
  ticketId: number,
  actionId: number,
  input: ActionInput,
  expectedVersion: number,
): Promise<ActionTakenData> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/actions/${actionId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, expectedVersion }),
  });
  return lab4Json<ActionTakenData>(res);
}

export async function transitionAction(
  ticketId: number,
  actionId: number,
  to: ActionStatus,
  expectedVersion: number,
  result?: string,
): Promise<ActionTakenData> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/actions/${actionId}/transition`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, expectedVersion, ...(result !== undefined && { result }) }),
  });
  return lab4Json<ActionTakenData>(res);
}

/** Active IT Staff and Administrators that can be assigned an action (Lab 4). */
export async function getAssignees(): Promise<{ id: number; name: string; role: string }[]> {
  const res = await fetch(`${API_URL}/api/staff/assignees`, { credentials: "include" });
  return (await lab4Json<{ users: { id: number; name: string; role: string }[] }>(res)).users;
}

// ---------------------------------------------------------------------------
// Lab 4 — Ticket workflow (docs/lab-04/api-spec.md, "Ticket Workflow")

export interface WorkflowTicket {
  id: number;
  currentStatus: string;
  version: number;
  allowedTransitions?: string[];
  resolvedAt?: string | null;
  closedAt?: string | null;
  requesterMarkedResolved: boolean;
  requesterMarkedResolvedAt?: string | null;
}

export interface StatusChangeData {
  id: number;
  fromStatus: string;
  toStatus: string;
  reason: string | null;
  createdAt: string;
  actor: { id: number; name: string };
}

export async function changeTicketStatus(
  ticketId: number,
  status: string,
  expectedVersion: number,
  reason?: string,
): Promise<WorkflowTicket> {
  const res = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/status`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, expectedVersion, ...(reason !== undefined && { reason }) }),
  });
  return (await lab4Json<{ ticket: WorkflowTicket }>(res)).ticket;
}

export async function getStatusHistory(ticketId: number): Promise<StatusChangeData[]> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/status-history`, { credentials: "include" });
  return (await lab4Json<{ items: StatusChangeData[] }>(res)).items;
}

export async function markProblemResolved(ticketId: number): Promise<WorkflowTicket> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/resolved-by-requester`, {
    method: "POST",
    credentials: "include",
  });
  return (await lab4Json<{ ticket: WorkflowTicket }>(res)).ticket;
}
