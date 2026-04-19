import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { discoverFaculties, loadCatalogForFaculty, searchBooks, searchBooksServer } from "../lib/bcu";
import type { Book, Faculty } from "../types";

type LibraryContextType = {
  faculties: Faculty[];
  activeFaculty: Faculty | null;
  books: Book[];
  loading: boolean;
  indexing: boolean;
  progressPercent: number;
  statusLine: string;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  setFacultyKey: (key: string) => void;
  refreshCatalog: (force?: boolean) => Promise<void>;
  filteredBooks: Book[];
};

const LibraryContext = createContext<LibraryContextType | null>(null);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [activeFacultyKey, setActiveFacultyKey] = useState<string>("");
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [indexing, setIndexing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [statusLine, setStatusLine] = useState("Initializing library...");
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const activeFaculty = useMemo(() => {
    return faculties.find((faculty) => faculty.key === activeFacultyKey) || null;
  }, [activeFacultyKey, faculties]);

  const refreshCatalog = useCallback(async (force = false) => {
    if (!activeFaculty) {
      return;
    }

    setIndexing(true);
    setError(null);
    setStatusLine(`Loading ${activeFaculty.label}...`);

    try {
      const nextBooks = await loadCatalogForFaculty(activeFaculty, {
        force,
        onProgress: (current, totalApprox) => {
          const percent = totalApprox > 0 ? Math.min(100, Math.round((current / totalApprox) * 100)) : 0;
          setProgressPercent(percent);
          setStatusLine(`Indexing ${activeFaculty.label}: ${current} folders scanned`);
        }
      });
      setBooks(nextBooks);
      setStatusLine(`Ready: ${nextBooks.length} PDF indexed in ${activeFaculty.label}`);
      setProgressPercent(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load BCU catalog");
      setStatusLine("Failed to load selected faculty.");
      setBooks([]);
    } finally {
      setIndexing(false);
      setLoading(false);
    }
  }, [activeFaculty]);

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      setError(null);
      try {
        const detected = await discoverFaculties();
        setFaculties(detected);
        if (detected.length > 0) {
          setActiveFacultyKey((prev) => prev || detected[0].key);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Cannot discover faculties");
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    if (!activeFaculty) {
      return;
    }
    refreshCatalog(false);
  }, [activeFaculty, refreshCatalog]);

  const [serverResults, setServerResults] = useState<Book[]>([]);
  const [isSearchingServer, setIsSearchingServer] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length >= 3) {
        setIsSearchingServer(true);
        const results = await searchBooksServer(searchQuery);
        setServerResults(results);
        setIsSearchingServer(false);
      } else {
        setServerResults([]);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredBooks = useMemo(() => {
    const local = searchBooks(books, searchQuery);
    
    // If we have server results, merge them with local results (avoiding duplicates)
    if (serverResults.length > 0) {
      const merged = [...local];
      const localIds = new Set(local.map(b => b.id));
      for (const b of serverResults) {
        if (!localIds.has(b.id)) {
          merged.push(b);
        }
      }
      return merged;
    }
    
    return local;
  }, [books, searchQuery, serverResults]);

  const value: LibraryContextType = {
    faculties,
    activeFaculty,
    books,
    loading,
    indexing,
    progressPercent,
    statusLine,
    error,
    searchQuery,
    setSearchQuery,
    setFacultyKey: setActiveFacultyKey,
    refreshCatalog,
    filteredBooks
  };

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
};

export function useLibrary(): LibraryContextType {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error("useLibrary must be used inside LibraryProvider");
  }
  return context;
}
