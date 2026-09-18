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
}): Promise<StaffQueueResult> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.owner) query.set("owner", params.owner);

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