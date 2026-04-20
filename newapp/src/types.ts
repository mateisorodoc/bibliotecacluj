export interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  coverImage: string;
  genre: string[];
  era: string;
  faculty: string;
  folderPath: string;
  filePath: string;
  date: string;
  sizeBytes: number;
  language?: string;
  languageSource?: "metadata" | "filename" | "inferred" | "unknown";
  department?: string;
  pages?: number;
  publishedYear?: number;
  publisher?: string;
  isbn?: string;
  progress?: number;
}

export interface ReadingList {
  id: number;
  name: string;
  itemCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Faculty {
  key: string;
  label: string;
  path: string;
}

export interface AppUser {
  id: number;
  username: string;
  role: "admin" | "user";
  displayName: string;
  avatarUrl: string;
  bio: string;
  kindleEmail: string;
  pendingInviteRequests?: number;
}

export interface AdminUser {
  id: number;
  username: string;
  role: "admin" | "user";
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface ReadingProgress {
  bookId: string;
  title: string;
  percentage: number;
  status: "none" | "reading" | "completed" | "wishlist";
  filePath: string;
  coverImage: string;
  updatedAt: string;
}

export interface ReadingListItem {
  listId: number;
  bookId: string;
  title: string;
  author?: string;
  coverImage?: string;
  filePath: string;
  addedAt: string;
}

export interface InviteLink {
  id: number;
  token: string;
  maxUses: number;
  usesCount: number;
  isActive: boolean;
  expiresAt?: string | null;
  createdAt: string;
  createdByUserId: number;
  createdByUsername?: string | null;
  inviteUrl: string;
}

export interface InviteRequest {
  id: number;
  inviteLinkId: number;
  inviteToken: string;
  username: string;
  status: "pending" | "approved" | "denied";
  decisionNote: string;
  invitedByUserId?: number | null;
  invitedByUsername?: string | null;
  reviewedByUserId?: number | null;
  reviewedByUsername?: string | null;
  approvedUserId?: number | null;
  requestedAt: string;
  reviewedAt?: string | null;
}

export interface PublicStats {
  totalDocuments: number;
  totalFaculties: number;
  totalDepartments: number;
  totalUsers: number;
  totalAccesses: number;
}
