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
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw { status: res.status, ...data };
  }
  return data;
}