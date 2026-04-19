import type { AdminUser, AppUser, ReadingList, ReadingListItem, ReadingProgress } from "../types";

type ApiOptions = RequestInit & { skipJson?: boolean };

async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const payload = options.skipJson ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error || `Request failed: ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

export async function authMe(): Promise<{ authenticated: boolean; user?: AppUser }> {
  return apiRequest<{ authenticated: boolean; user?: AppUser }>("/api/auth/me");
}

export async function login(username: string, password: string): Promise<AppUser> {
  const result = await apiRequest<{ ok: boolean; user: AppUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
  return result.user;
}

export async function logout(): Promise<void> {
  await apiRequest<{ ok: boolean }>("/api/auth/logout", {
    method: "POST",
    body: "{}"
  });
}

export async function getProfile(): Promise<AppUser> {
  const result = await apiRequest<{ profile: AppUser }>("/api/user/profile");
  return result.profile;
}

export async function updateProfile(input: { displayName: string; avatarUrl?: string; bio?: string }): Promise<AppUser> {
  const result = await apiRequest<{ ok: boolean; profile: AppUser }>("/api/user/profile", {
    method: "PATCH",
    body: JSON.stringify(input)
  });
  return result.profile;
}

export async function listReadingLists(): Promise<ReadingList[]> {
  const result = await apiRequest<{ lists: ReadingList[] }>("/api/user/lists");
  return result.lists;
}

export async function createReadingList(name: string): Promise<number> {
  const result = await apiRequest<{ ok: boolean; listId: number }>("/api/user/lists", {
    method: "POST",
    body: JSON.stringify({ name })
  });
  return result.listId;
}

export async function renameReadingList(listId: number, name: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/api/user/lists/${listId}`, {
    method: "PATCH",
    body: JSON.stringify({ name })
  });
}

export async function deleteReadingList(listId: number): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/api/user/lists/${listId}`, {
    method: "DELETE"
  });
}

export async function listReadingListItems(listId: number): Promise<ReadingListItem[]> {
  const result = await apiRequest<{ items: ReadingListItem[] }>(`/api/user/lists/${listId}/items`);
  return result.items;
}

export async function addReadingListItem(listId: number, item: {
  bookId: string;
  title: string;
  author?: string;
  coverImage?: string;
  filePath: string;
}): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/api/user/lists/${listId}/items`, {
    method: "POST",
    body: JSON.stringify(item)
  });
}

export async function removeReadingListItem(listId: number, bookId: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/api/user/lists/${listId}/items/${encodeURIComponent(bookId)}`, {
    method: "DELETE"
  });
}

export async function listProgress(): Promise<ReadingProgress[]> {
  const result = await apiRequest<{ progress: ReadingProgress[] }>("/api/user/progress");
  return result.progress;
}

export async function upsertProgress(bookId: string, payload: {
  title: string;
  percentage: number;
  status?: "none" | "reading" | "completed" | "wishlist";
  filePath?: string;
  coverImage?: string;
}): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/api/user/progress/${encodeURIComponent(bookId)}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function listHistory(): Promise<ReadingProgress[]> {
  const result = await apiRequest<{ items: ReadingProgress[] }>("/api/user/history");
  return result.items;
}

export async function listWishlist(): Promise<ReadingProgress[]> {
  const result = await apiRequest<{ items: ReadingProgress[] }>("/api/user/wishlist");
  return result.items;
}

export async function getDashboardSummary(): Promise<{
  summary: {
    completedCount: number;
    readingCount: number;
    wishlistCount: number;
    trackedCount: number;
    listCount: number;
  };
  recent: ReadingProgress[];
}> {
  return apiRequest("/api/user/dashboard-summary");
}

export async function resolveFileUrl(sourceUrl: string): Promise<string> {
  const response = await apiRequest<{ url: string }>(`/api/bcu/resolve-file?url=${encodeURIComponent(sourceUrl)}`);
  return response.url || sourceUrl;
}

export function getBcuDownloadUrl(sourceUrl: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/api/bcu/download?url=${encodeURIComponent(sourceUrl)}`;
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const result = await apiRequest<{ users: AdminUser[] }>("/api/admin/users");
  return result.users || [];
}

export async function createAdminUser(input: {
  username: string;
  password: string;
  role: "admin" | "user";
  isActive: boolean;
}): Promise<void> {
  await apiRequest<{ ok: boolean }>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateAdminUser(userId: number, input: {
  username?: string;
  password?: string;
  role?: "admin" | "user";
  isActive?: boolean;
}): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/api/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function deleteAdminUser(userId: number): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/api/admin/users/${userId}`, {
    method: "DELETE"
  });
}
