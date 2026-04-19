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
