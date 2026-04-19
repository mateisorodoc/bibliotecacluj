import { BrowserRouter as Router, Routes, Route, Link, Outlet, useLocation, Navigate, useNavigate, useParams } from "react-router-dom";
import React, { useEffect, useMemo, useState } from "react";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import DashboardOverview from "./components/DashboardOverview";
import BookDetailsPage from "./components/BookDetailsPage";
import LoginPage from "./components/LoginPage";
import ProfilePage from "./components/ProfilePage";
import CoverImage from "./components/CoverImage";
import { useAuth } from "./context/AuthContext";
import { useLibrary } from "./context/LibraryContext";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Instagram, Twitter, Mail, BookOpen, Users, Building2 } from "lucide-react";
import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  listHistory,
  listProgress,
  listReadingListItems,
  listReadingLists,
  listWishlist,
  updateAdminUser
} from "./lib/api";
import { loadCatalogForFaculty, searchBooks } from "./lib/bcu";
import type { AdminUser, Book, Faculty, ReadingListItem, ReadingProgress } from "./types";

const MULTI_FACULTY_MODE_KEY = "bcu_multi_faculty_mode_v1";
const MULTI_FACULTY_SELECTION_KEY = "bcu_multi_faculty_selection_v1";

function buildGenericTileImage(kind: "faculty" | "department"): string {
  const label = kind === "faculty" ? "FACULTATE" : "DEPARTAMENT";
  const accent = kind === "faculty" ? "#2f5d50" : "#6d5434";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="500" viewBox="0 0 1200 500" role="img" aria-label="${label}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ece8dc"/>
          <stop offset="100%" stop-color="#d6ddd2"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="500" fill="url(#bg)"/>
      <rect x="64" y="64" width="1072" height="372" fill="none" stroke="${accent}" stroke-width="2" opacity="0.35"/>
      <text x="600" y="225" text-anchor="middle" font-family="Georgia, serif" font-size="56" fill="${accent}">Biblioteca Alternativa Cluj</text>
      <text x="600" y="290" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="${accent}" letter-spacing="6">${label}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const GENERIC_FACULTY_IMAGE = buildGenericTileImage("faculty");
const GENERIC_DEPARTMENT_IMAGE = buildGenericTileImage("department");

function toDisplayFolderPath(folderPath: string): string {
  if (!folderPath) {
    return "radacina";
  }

  try {
    const parsed = new URL(folderPath);
    const clean = decodeURIComponent(parsed.pathname)
      .replace(/^\/pdfview\/?/i, "")
      .replace(/\/+$/, "");
    return clean || "radacina";
  } catch {
    const clean = decodeURIComponent(folderPath).replace(/\/+$/, "");
    return clean || "radacina";
  }
}

function toDisplayTitle(title: string): string {
  return (title || "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function loadBooksForFaculties(
  faculties: Faculty[],
  force = false,
  onProgress?: (done: number, total: number, label: string) => void
): Promise<Book[]> {
  if (!faculties.length) {
    return [];
  }

  const unique = new Map<string, Book>();
  const queue = [...faculties];
  const total = queue.length;
  let done = 0;

  while (queue.length) {
    const batch = queue.splice(0, 2);
    const loaded = await Promise.all(batch.map((faculty) => loadCatalogForFaculty(faculty, { force })));

    for (let index = 0; index < batch.length; index += 1) {
      const currentFaculty = batch[index];
      const books = loaded[index] || [];

      for (const book of books) {
        unique.set(book.filePath, { ...book, faculty: currentFaculty.label });
      }

      done += 1;
      if (onProgress) {
        onProgress(done, total, currentFaculty.label);
      }
    }
  }

  return Array.from(unique.values()).sort((a, b) => a.title.localeCompare(b.title, "ro"));
}

function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function DashboardLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-low">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-surface-low">
      <Navbar />
      <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-12 flex flex-col md:flex-row gap-12">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function BookCard({ book }: { book: Book }) {
  const year = book.publishedYear || Number.parseInt(book.era, 10) || undefined;
  const displayTitle = toDisplayTitle(book.title);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="group">
      <Link to={`/book/${encodeURIComponent(book.id)}`}>
        <div className="aspect-[3/4.5] rounded-xs overflow-hidden mb-6 shadow-sm shadow-ink/10 group-hover:shadow-2xl transition-all duration-700 relative">
          <CoverImage
            src={book.coverImage}
            title={book.title}
            seed={book.id}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
          />
          <div className="absolute inset-0 bg-ink/20 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink/40 mb-2">{book.genre[0]}</p>
        <h3
          title={displayTitle}
          className="font-serif text-xl sm:text-2xl font-bold text-ink leading-tight mb-2 group-hover:text-primary transition-colors whitespace-normal break-words [overflow-wrap:anywhere]"
        >
          {displayTitle}
        </h3>
        <p className="font-serif italic text-ink/60">{book.author}</p>
        <p className="mt-2 text-[10px] uppercase tracking-widest font-bold text-ink/35">
          {book.language || "Nespecificata"}
          {year ? ` · ${year}` : ""}
        </p>
        <p className="mt-1 text-[10px] text-ink/40 truncate">Folder: {toDisplayFolderPath(book.folderPath)}</p>
      </Link>
    </motion.div>
  );
}

function HomePage() {
  const { books, activeFaculty, statusLine } = useLibrary();
  const featured = books.slice(0, 4);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="bg-surface-base">
      <section className="relative h-[90vh] flex items-center overflow-hidden px-6 md:px-12">
        <div className="max-w-[1440px] mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }} className="z-10">
            <span className="font-sans text-xs uppercase tracking-[0.4em] font-bold text-primary mb-6 block">Biblioteca Alternativa Cluj</span>
            <h1 className="text-6xl md:text-8xl font-serif font-bold text-ink mb-8 leading-[0.95] tracking-tight">
              Descopera patrimoniul <br />
              <span className="italic font-normal">academiei clujene.</span>
            </h1>
            <p className="max-w-md text-lg md:text-xl font-serif text-ink/60 italic leading-relaxed mb-4">
              Search digital universitar cu acces la mii de documente, periodice si colectii istorice.
            </p>
            <p className="max-w-md text-sm text-ink/50 mb-10">{statusLine}</p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/search" className="px-10 py-5 bg-ink text-on-primary font-sans text-xs uppercase tracking-[0.2em] font-bold rounded-lg hover:bg-primary transition-all flex items-center justify-center group">
                Intra in Search <ArrowRight size={16} className="ml-3 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link to="/dashboard" className="px-10 py-5 border border-ink/20 text-ink/60 font-sans text-xs uppercase tracking-[0.2em] font-bold rounded-lg hover:border-primary hover:text-primary transition-all flex items-center justify-center">
                Biblioteca Mea
              </Link>
            </div>
          </motion.div>

          <div className="hidden lg:flex relative h-full items-center justify-end">
            <motion.div initial={{ opacity: 0, scale: 0.9, rotate: 2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ duration: 1, delay: 0.2 }} className="w-[120%] h-[700px] relative">
              <div className="absolute inset-0 bg-primary/10 rounded-[100px] -rotate-6 blur-3xl opacity-30" />
              <div className="relative h-full aspect-[4/5] mx-auto shadow-2xl rounded-2xl overflow-hidden group">
                <CoverImage
                  src={featured[0]?.coverImage || "https://picsum.photos/seed/library_hero/1200/1500"}
                  title={featured[0]?.title || "Biblioteca Alternativa Cluj"}
                  seed={featured[0]?.id || "library_hero"}
                  className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-1000"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent flex items-end p-12">
                  <div className="text-on-primary">
                    <p className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-60 mb-2">Active Faculty</p>
                    <h3 className="text-3xl font-serif font-bold italic tracking-tight">{activeFaculty?.label || "Loading..."}</h3>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="bg-surface-low py-32">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <div>
              <h2 className="text-4xl font-serif font-bold text-ink italic mb-4 tracking-tight">Recomandari din facultatea curenta</h2>
              <p className="text-ink/60 font-sans tracking-wide">{activeFaculty?.label || "Search"}</p>
            </div>
            <Link to="/search" className="text-xs uppercase font-bold tracking-widest text-primary hover:opacity-70 flex items-center pb-2 border-b border-primary/20">
              Exploreaza Colectia <ArrowRight size={14} className="ml-2" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {featured.map((book) => (
              <motion.div key={book.id} className="group cursor-pointer" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <Link to={`/book/${encodeURIComponent(book.id)}`}>
                  <div className="aspect-[2/3] rounded-sm overflow-hidden mb-6 shadow-md shadow-ink/5 group-hover:shadow-xl group-hover:-translate-y-2 transition-all duration-500">
                    <CoverImage src={book.coverImage} title={book.title} seed={book.id} className="w-full h-full object-cover" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-serif text-xl font-bold text-ink leading-tight group-hover:text-primary transition-colors">{book.title}</h4>
                    <p className="font-serif italic text-ink/50 text-base">{book.author}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </motion.div>
  );
}

function CatalogPage() {
  const {
    faculties,
    activeFaculty,
    setFacultyKey,
    filteredBooks,
    loading,
    indexing,
    progressPercent,
    statusLine,
    searchQuery,
    setSearchQuery,
    refreshCatalog,
    error
  } = useLibrary();

  const [multiFacultyMode, setMultiFacultyMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(MULTI_FACULTY_MODE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [selectedFacultyKeys, setSelectedFacultyKeys] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(MULTI_FACULTY_SELECTION_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : [];
    } catch {
      return [];
    }
  });
  const [multiFacultyBooks, setMultiFacultyBooks] = useState<Book[]>([]);
  const [multiLoading, setMultiLoading] = useState(false);
  const [multiProgressPercent, setMultiProgressPercent] = useState(0);
  const [multiStatusLine, setMultiStatusLine] = useState("Selecteaza facultatile pentru explorare extinsa.");
  const [multiError, setMultiError] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState("title");
  const [yearFilter, setYearFilter] = useState("all");
  const [authorFilter, setAuthorFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [departmentFacultyKey, setDepartmentFacultyKey] = useState("");
  const [visibleCount, setVisibleCount] = useState(24);

  useEffect(() => {
    try {
      localStorage.setItem(MULTI_FACULTY_MODE_KEY, multiFacultyMode ? "1" : "0");
    } catch {
      // Optional persistence.
    }
  }, [multiFacultyMode]);

  useEffect(() => {
    try {
      localStorage.setItem(MULTI_FACULTY_SELECTION_KEY, JSON.stringify(selectedFacultyKeys));
    } catch {
      // Optional persistence.
    }
  }, [selectedFacultyKeys]);

  useEffect(() => {
    if (!faculties.length) {
      return;
    }

    const valid = selectedFacultyKeys.filter((key) => faculties.some((faculty) => faculty.key === key));
    if (valid.length !== selectedFacultyKeys.length) {
      setSelectedFacultyKeys(valid);
    }
  }, [faculties, selectedFacultyKeys]);

  useEffect(() => {
    if (selectedFacultyKeys.length > 0) {
      return;
    }

    if (activeFaculty?.key) {
      setSelectedFacultyKeys([activeFaculty.key]);
      return;
    }

    if (faculties.length > 0) {
      setSelectedFacultyKeys([faculties[0].key]);
    }
  }, [selectedFacultyKeys.length, activeFaculty?.key, faculties]);

  const selectedFaculties = useMemo(() => {
    return faculties.filter((faculty) => selectedFacultyKeys.includes(faculty.key));
  }, [faculties, selectedFacultyKeys]);

  const refreshMultiCatalog = async (force = false) => {
    if (!selectedFaculties.length) {
      return;
    }

    setMultiLoading(true);
    setMultiError(null);
    setMultiProgressPercent(0);
    setMultiStatusLine(`Se incarca ${selectedFaculties.length} facultati...`);

    try {
      const loaded = await loadBooksForFaculties(selectedFaculties, force, (done, total, label) => {
        const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
        setMultiProgressPercent(percent);
        setMultiStatusLine(`Indexare multi-facultate: ${done}/${total} (${label})`);
      });

      setMultiFacultyBooks(loaded);
      setMultiProgressPercent(100);
      setMultiStatusLine(`Gata: ${loaded.length} documente din ${selectedFaculties.length} facultati.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nu am putut incarca facultatile selectate.";
      setMultiError(message);
      setMultiStatusLine("Indexarea multi-facultate a esuat.");
    } finally {
      setMultiLoading(false);
    }
  };

  useEffect(() => {
    if (!multiFacultyMode) {
      return;
    }

    refreshMultiCatalog(false);
  }, [multiFacultyMode, selectedFacultyKeys.join("|"), faculties.length]);

  useEffect(() => {
    if (!multiFacultyMode) {
      setDepartmentFacultyKey("");
      return;
    }

    if (!selectedFacultyKeys.length) {
      setDepartmentFacultyKey("");
      return;
    }

    setDepartmentFacultyKey((current) => {
      if (current && selectedFacultyKeys.includes(current)) {
        return current;
      }

      if (activeFaculty?.key && selectedFacultyKeys.includes(activeFaculty.key)) {
        return activeFaculty.key;
      }

      return selectedFacultyKeys[0];
    });
  }, [multiFacultyMode, selectedFacultyKeys.join("|"), activeFaculty?.key]);

  const baseBooks = useMemo(() => {
    if (!multiFacultyMode) {
      return filteredBooks;
    }

    return searchBooks(multiFacultyBooks, searchQuery);
  }, [multiFacultyMode, filteredBooks, multiFacultyBooks, searchQuery]);

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const book of baseBooks) {
      const year = book.publishedYear || Number.parseInt(book.era, 10);
      if (Number.isFinite(year) && year > 0) {
        set.add(year);
      }
    }

    return ["all", ...Array.from(set).sort((a, b) => b - a).map(String)];
  }, [baseBooks]);

  const authors = useMemo(() => {
    const set = new Set(baseBooks.map((book) => (book.author || "").trim()).filter(Boolean));
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b, "ro"))];
  }, [baseBooks]);

  const departments = useMemo(() => {
    const scopedFacultyLabel = multiFacultyMode && departmentFacultyKey
      ? faculties.find((faculty) => faculty.key === departmentFacultyKey)?.label
      : null;

    const source = scopedFacultyLabel
      ? baseBooks.filter((book) => (book.faculty || "").trim() === scopedFacultyLabel)
      : baseBooks;

    const set = new Set(source.map((book) => (book.department || "General").trim()));
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b, "ro"))];
  }, [baseBooks, faculties, multiFacultyMode, departmentFacultyKey]);

  useEffect(() => {
    if (departmentFilter === "all") {
      return;
    }

    if (!departments.includes(departmentFilter)) {
      setDepartmentFilter("all");
    }
  }, [departments, departmentFilter]);

  const displayBooks = useMemo(() => {
    const scopedFacultyLabel = multiFacultyMode && departmentFacultyKey
      ? faculties.find((faculty) => faculty.key === departmentFacultyKey)?.label
      : null;

    const filtered = baseBooks.filter((book) => {
      const bookYear = String(book.publishedYear || Number.parseInt(book.era, 10) || "");
      const bookDepartment = (book.department || "General").trim();

      return (
        (yearFilter === "all" || bookYear === yearFilter) &&
        (authorFilter === "all" || book.author === authorFilter) &&
        (departmentFilter === "all" || bookDepartment === departmentFilter) &&
        (!scopedFacultyLabel || (book.faculty || "").trim() === scopedFacultyLabel)
      );
    });

    const sorted = [...filtered];
    if (sortBy === "author") {
      sorted.sort((a, b) => a.author.localeCompare(b.author));
    } else if (sortBy === "language") {
      sorted.sort((a, b) => (a.language || "Nespecificata").localeCompare(b.language || "Nespecificata", "ro"));
    } else if (sortBy === "year") {
      sorted.sort((a, b) => {
        const aYear = a.publishedYear || Number.parseInt(a.era, 10) || 0;
        const bYear = b.publishedYear || Number.parseInt(b.era, 10) || 0;
        return bYear - aYear;
      });
    } else if (sortBy === "title") {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      sorted.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    }
    return sorted;
  }, [baseBooks, yearFilter, authorFilter, departmentFilter, sortBy, faculties, multiFacultyMode, departmentFacultyKey]);

  useEffect(() => {
    setVisibleCount(24);
  }, [activeFaculty?.key, searchQuery, sortBy, yearFilter, authorFilter, departmentFilter, multiFacultyMode, selectedFacultyKeys.join("|"), departmentFacultyKey]);

  const catalogStatusLine = multiFacultyMode ? multiStatusLine : statusLine;
  const catalogLoading = multiFacultyMode ? multiLoading : loading;
  const catalogError = multiFacultyMode ? multiError : error;
  const refreshLabel = multiFacultyMode
    ? (multiLoading ? `Indexare ${multiProgressPercent}%` : "Reconstruieste selectie")
    : (indexing ? `Indexare ${progressPercent}%` : "Reconstruieste index");

  const handleRefresh = () => {
    if (multiFacultyMode) {
      refreshMultiCatalog(true);
      return;
    }

    refreshCatalog(true);
  };

  const hasSecondaryFilters = yearFilter !== "all"
    || authorFilter !== "all"
    || departmentFilter !== "all";

  const clearSecondaryFilters = () => {
    setYearFilter("all");
    setAuthorFilter("all");
    setDepartmentFilter("all");
  };

  const toggleSelectedFacultyKey = (key: string) => {
    setSelectedFacultyKeys((current) => {
      if (current.includes(key)) {
        if (current.length === 1) {
          return current;
        }
        return current.filter((entry) => entry !== key);
      }

      return [...current, key];
    });
  };

  const selectAllFaculties = () => {
    setSelectedFacultyKeys(faculties.map((faculty) => faculty.key));
  };

  const selectOnlyActiveFaculty = () => {
    if (activeFaculty?.key) {
      setSelectedFacultyKeys([activeFaculty.key]);
      return;
    }

    if (faculties.length > 0) {
      setSelectedFacultyKeys([faculties[0].key]);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="max-w-[1440px] mx-auto px-6 md:px-12 py-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-8">
        <div>
          <h1 className="text-5xl font-serif font-bold text-ink mb-2">Biblioteca Alternativa Cluj</h1>
          <p className="text-ink/60 font-serif italic text-xl leading-relaxed">{catalogStatusLine}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setMultiFacultyMode((current) => !current)}
            className={`px-4 py-2 rounded-md text-xs uppercase tracking-widest font-bold border transition-colors ${multiFacultyMode ? "bg-primary text-white border-primary" : "border-ink/20 text-ink/70"}`}
          >
            {multiFacultyMode ? "Mod multi-facultate activ" : "Activeaza multi-facultate"}
          </button>
          <button onClick={handleRefresh} disabled={catalogLoading || indexing} className="px-4 py-2 rounded-md bg-ink text-white text-xs uppercase tracking-widest font-bold disabled:opacity-50">
            {refreshLabel}
          </button>
          <button
            onClick={clearSecondaryFilters}
            disabled={!hasSecondaryFilters}
            className="px-4 py-2 rounded-md border border-ink/20 text-ink/70 text-xs uppercase tracking-widest font-bold disabled:opacity-40"
          >
            Reset filtre
          </button>
        </div>
      </div>

      {catalogError ? (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {catalogError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {multiFacultyMode ? (
          <div className="space-y-3 lg:col-span-3 rounded-xl border border-ink/10 bg-surface-low p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-widest font-bold text-ink/45">
                Selecteaza facultatile pentru cautare ({selectedFacultyKeys.length} active)
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectOnlyActiveFaculty}
                  className="px-3 py-1 rounded-md border border-ink/20 text-[10px] uppercase tracking-widest font-bold text-ink/65"
                >
                  Doar facultatea curenta
                </button>
                <button
                  type="button"
                  onClick={selectAllFaculties}
                  className="px-3 py-1 rounded-md border border-ink/20 text-[10px] uppercase tracking-widest font-bold text-ink/65"
                >
                  Selecteaza toate
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {faculties.map((faculty) => {
                const isSelected = selectedFacultyKeys.includes(faculty.key);
                return (
                  <button
                    key={faculty.key}
                    type="button"
                    onClick={() => toggleSelectedFacultyKey(faculty.key)}
                    className={`text-left rounded-md border px-3 py-2 text-sm transition-colors ${isSelected ? "border-primary bg-white text-ink" : "border-ink/15 text-ink/60 hover:border-ink/35"}`}
                  >
                    {isSelected ? "● " : "○ "}
                    {faculty.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <select
            value={activeFaculty?.key || ""}
            onChange={(event) => setFacultyKey(event.target.value)}
            className="bg-transparent border-b border-ink/20 py-2 px-4 focus:outline-none focus:border-primary text-sm font-sans tracking-widest text-ink/60 cursor-pointer"
          >
            {faculties.map((faculty) => (
              <option key={faculty.key} value={faculty.key}>{faculty.label}</option>
            ))}
          </select>
        )}

        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={multiFacultyMode ? "Cauta in facultatile selectate (titlu, autor, departament)..." : "Cauta titlu, autor..."}
          className="bg-transparent border-b border-ink/20 py-2 px-4 focus:outline-none focus:border-primary text-sm font-sans tracking-wide text-ink/60"
        />

        <select
          value={yearFilter}
          onChange={(event) => setYearFilter(event.target.value)}
          className="bg-transparent border-b border-ink/20 py-2 px-4 focus:outline-none focus:border-primary text-sm font-sans tracking-widest text-ink/60 cursor-pointer"
        >
          {years.map((year) => (
            <option key={year} value={year}>{year === "all" ? "Toti anii" : year}</option>
          ))}
        </select>

        <select
          value={authorFilter}
          onChange={(event) => setAuthorFilter(event.target.value)}
          className="bg-transparent border-b border-ink/20 py-2 px-4 focus:outline-none focus:border-primary text-sm font-sans tracking-widest text-ink/60 cursor-pointer"
        >
          {authors.map((author) => (
            <option key={author} value={author}>{author === "all" ? "Toti autorii / colectiile" : author}</option>
          ))}
        </select>

        {multiFacultyMode && selectedFaculties.length > 1 ? (
          <select
            value={departmentFacultyKey}
            onChange={(event) => setDepartmentFacultyKey(event.target.value)}
            className="bg-transparent border-b border-ink/20 py-2 px-4 focus:outline-none focus:border-primary text-sm font-sans tracking-widest text-ink/60 cursor-pointer"
          >
            {selectedFaculties.map((faculty) => (
              <option key={faculty.key} value={faculty.key}>{`Departamente: ${faculty.label}`}</option>
            ))}
          </select>
        ) : null}

        <select
          value={departmentFilter}
          onChange={(event) => setDepartmentFilter(event.target.value)}
          className="bg-transparent border-b border-ink/20 py-2 px-4 focus:outline-none focus:border-primary text-sm font-sans tracking-widest text-ink/60 cursor-pointer"
        >
          {departments.map((department) => (
            <option key={department} value={department}>{department === "all" ? "Toate departamentele" : department}</option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
          className="bg-transparent border-b border-ink/20 py-2 px-4 focus:outline-none focus:border-primary text-sm font-sans tracking-widest text-ink/60 cursor-pointer"
        >
          <option value="author">Sorteaza dupa autor</option>
          <option value="title">Sorteaza dupa titlu</option>
          <option value="language">Sorteaza dupa limba</option>
          <option value="year">Sorteaza dupa an</option>
          <option value="recent">Sorteaza dupa data</option>
        </select>
      </div>

      {multiFacultyMode ? (
        <div className="mb-10 rounded-xl border border-ink/10 bg-surface-low p-4">
          <p className="text-[10px] uppercase tracking-widest font-bold text-ink/45 mb-3">
            Facultati selectate ({selectedFaculties.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedFaculties.map((faculty) => (
              <span key={faculty.key} className="px-3 py-1 rounded-full bg-white border border-ink/10 text-xs text-ink/70">
                {faculty.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {catalogLoading ? (
        <div className="py-24 text-center text-ink/50 italic">Search se incarca...</div>
      ) : (
        <>
        {(searchQuery.trim() || hasSecondaryFilters) ? (
          <div className="mb-6 rounded-md border border-ink/10 bg-surface-low px-4 py-3 text-xs uppercase tracking-widest text-ink/55">
            {searchQuery.trim()
              ? `Potriviri cautare: ${baseBooks.length} · Afisate dupa filtre: ${displayBooks.length}`
              : `Filtre active · Afisate: ${displayBooks.length}`}
          </div>
        ) : null}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-10 gap-y-16">
          {displayBooks.slice(0, visibleCount).map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
        {displayBooks.length > visibleCount ? (
          <div className="mt-10 flex justify-center">
            <button
              onClick={() => setVisibleCount((current) => Math.min(displayBooks.length, current + 24))}
              className="px-5 py-3 rounded-md border border-ink/20 text-xs uppercase tracking-widest font-bold text-ink/70 hover:text-primary hover:border-primary transition-colors"
            >
              Incarca mai multe ({displayBooks.length - visibleCount} ramase)
            </button>
          </div>
        ) : null}
        </>
      )}
    </motion.div>
  );
}

function AuthorsPage() {
  const navigate = useNavigate();
  const { books, faculties, setSearchQuery } = useLibrary();
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);

  useEffect(() => {
    if (!faculties.length) {
      return;
    }

    setLoadingAll(true);
    loadBooksForFaculties(faculties, false)
      .then((loaded) => setAllBooks(loaded))
      .catch(() => setAllBooks([]))
      .finally(() => setLoadingAll(false));
  }, [faculties.length]);

  const sourceBooks = allBooks.length ? allBooks : books;

  const authors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const book of sourceBooks) {
      const key = (book.author || "Necunoscut").trim() || "Necunoscut";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 120);
  }, [sourceBooks]);

  const years = useMemo(() => {
    const counts = new Map<number, number>();
    for (const book of sourceBooks) {
      const year = book.publishedYear || Number.parseInt(book.era, 10);
      if (!Number.isFinite(year) || year <= 0) {
        continue;
      }

      counts.set(year, (counts.get(year) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => b.year - a.year)
      .slice(0, 120);
  }, [sourceBooks]);

  const goToSearch = (term: string) => {
    setSearchQuery(term);
    navigate("/search");
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-20">
      <h1 className="text-5xl font-serif font-bold text-ink mb-3">Autori si Colectii</h1>
      <p className="text-ink/60 font-serif italic mb-12">Navigheaza rapid dupa autor sau an (click pentru a deschide filtrat in Search).</p>
      {loadingAll ? <p className="text-sm text-ink/40 mb-6">Se agrega automat indexul din toate facultatile...</p> : null}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {authors.map((entry) => (
          <button key={entry.name} onClick={() => goToSearch(entry.name)} className="rounded-xl border border-ink/10 bg-surface-low p-4 flex items-center justify-between text-left hover:border-primary/30 hover:bg-white transition-colors">
            <span className="font-serif text-ink">{entry.name}</span>
            <span className="text-xs uppercase tracking-widest font-bold text-ink/40">{entry.count} doc</span>
          </button>
        ))}
      </div>

      <h2 className="text-3xl font-serif font-bold text-ink mt-16 mb-6">Navigare dupa ani</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {years.map((entry) => (
          <button key={entry.year} onClick={() => goToSearch(String(entry.year))} className="rounded-lg border border-ink/10 bg-white px-4 py-3 text-left hover:border-primary/30 transition-colors">
            <p className="font-serif text-xl text-ink">{entry.year}</p>
            <p className="text-[10px] uppercase tracking-widest font-bold text-ink/40">{entry.count} doc</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function ExplorePage() {
  const navigate = useNavigate();
  const { faculties, setFacultyKey, setSearchQuery } = useLibrary();
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [status, setStatus] = useState("Pregatire explorare...");

  useEffect(() => {
    if (!faculties.length) {
      return;
    }

    setLoadingAll(true);
    setStatus("Se incarca toate facultatile...");

    loadBooksForFaculties(faculties, false, (done, total, label) => {
      setStatus(`Explorare: ${done}/${total} (${label})`);
    })
      .then((loaded) => {
        setAllBooks(loaded);
        setStatus(`Explorare gata: ${loaded.length} documente.`);
      })
      .catch(() => {
        setAllBooks([]);
        setStatus("Explorarea globala nu a putut fi incarcata.");
      })
      .finally(() => setLoadingAll(false));
  }, [faculties.length]);

  const exploreFilteredBooks = useMemo(() => allBooks, [allBooks]);

  const facultyStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const book of exploreFilteredBooks) {
      const label = book.faculty || "Necunoscut";
      counts.set(label, (counts.get(label) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [exploreFilteredBooks]);

  const departmentStats = useMemo(() => {
    const counts = new Map<string, { faculty: string; department: string; count: number }>();

    for (const book of exploreFilteredBooks) {
      const faculty = book.faculty || "Necunoscut";
      const department = (book.department || "General").trim() || "General";
      const key = `${faculty}|||${department}`;
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { faculty, department, count: 1 });
      }
    }

    return Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 180);
  }, [exploreFilteredBooks]);

  const uniqueAuthorsCount = useMemo(() => {
    return new Set(exploreFilteredBooks.map((book) => (book.author || "").trim()).filter(Boolean)).size;
  }, [exploreFilteredBooks]);

  const openFaculty = (facultyLabel: string) => {
    const target = faculties.find((entry) => entry.label === facultyLabel);
    if (target) {
      setFacultyKey(target.key);
    }
    setSearchQuery("");
    navigate("/search");
  };

  const openDepartment = (facultyLabel: string, department: string) => {
    const target = faculties.find((entry) => entry.label === facultyLabel);
    if (target) {
      setFacultyKey(target.key);
    }
    setSearchQuery(department);
    navigate("/search");
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-20 space-y-12">
      <div>
        <h1 className="text-4xl sm:text-5xl font-serif font-bold text-ink mb-3">Explorare Facultati si Departamente</h1>
        <p className="text-ink/60 font-serif italic">Navigheaza pe intreaga colectie. Selectezi cardul si intri direct in Search filtrat.</p>
        <p className="text-sm text-ink/40 mt-3">{status}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-xl border border-ink/10 bg-surface-low p-4 sm:p-5">
          <p className="text-[10px] uppercase tracking-widest font-bold text-ink/40">Documente totale</p>
          <p className="font-serif text-2xl sm:text-3xl text-ink mt-2">{exploreFilteredBooks.length}</p>
        </div>
        <div className="rounded-xl border border-ink/10 bg-surface-low p-4 sm:p-5">
          <p className="text-[10px] uppercase tracking-widest font-bold text-ink/40">Autori unici</p>
          <p className="font-serif text-2xl sm:text-3xl text-ink mt-2">{uniqueAuthorsCount}</p>
        </div>
        <div className="rounded-xl border border-ink/10 bg-surface-low p-4 sm:p-5 col-span-2 lg:col-span-1">
          <p className="text-[10px] uppercase tracking-widest font-bold text-ink/40">Departamente identificate</p>
          <p className="font-serif text-2xl sm:text-3xl text-ink mt-2">{departmentStats.length}</p>
        </div>
      </div>

      <section>
        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-ink mb-4 sm:mb-6 flex items-center gap-3"><Building2 size={24} /> Facultati</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {facultyStats.map((entry) => (
            <button key={entry.label} onClick={() => openFaculty(entry.label)} className="rounded-xl border border-ink/10 bg-white p-3 sm:p-4 text-left hover:border-primary/30 transition-colors">
              <div className="mb-3 h-20 sm:h-24 overflow-hidden rounded-lg border border-ink/10">
                <img src={GENERIC_FACULTY_IMAGE} alt="Facultate" className="h-full w-full object-cover" />
              </div>
              <p className="font-serif text-base sm:text-lg text-ink leading-tight">{entry.label}</p>
              <p className="text-[9px] sm:text-[10px] uppercase tracking-widest font-bold text-ink/40 mt-2">{entry.count} documente</p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-ink mb-4 sm:mb-6 flex items-center gap-3"><Users size={24} /> Departamente</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {departmentStats.map((entry) => (
            <button key={`${entry.faculty}-${entry.department}`} onClick={() => openDepartment(entry.faculty, entry.department)} className="rounded-xl border border-ink/10 bg-white p-3 sm:p-4 text-left hover:border-primary/30 transition-colors">
              <div className="mb-3 h-16 sm:h-20 overflow-hidden rounded-lg border border-ink/10">
                <img src={GENERIC_DEPARTMENT_IMAGE} alt="Departament" className="h-full w-full object-cover" />
              </div>
              <p className="font-serif text-sm sm:text-base text-ink leading-tight">{entry.department}</p>
              <p className="text-[11px] sm:text-xs text-ink/50 mt-1">{entry.faculty}</p>
              <p className="text-[9px] sm:text-[10px] uppercase tracking-widest font-bold text-ink/40 mt-2">{entry.count} documente</p>
            </button>
          ))}
        </div>
      </section>

      {loadingAll ? <div className="py-8 text-center text-ink/50 italic">Se agrega datele pentru explorare extinsa...</div> : null}
    </div>
  );
}

function toBookFromProgress(progress: ReadingProgress): Book {
  return {
    id: progress.bookId,
    title: progress.title,
    author: "BCU",
    description: "Saved from user history.",
    coverImage: progress.coverImage || `https://picsum.photos/seed/${encodeURIComponent(progress.bookId)}/480/720`,
    genre: ["Personal"],
    era: progress.status,
    faculty: "BCU",
    folderPath: "",
    filePath: progress.filePath,
    date: progress.updatedAt,
    sizeBytes: 0,
    progress: progress.percentage
  };
}

function toBookFromListItem(item: ReadingListItem): Book {
  return {
    id: item.bookId,
    title: item.title,
    author: item.author || "BCU",
    description: "Saved to reading list.",
    coverImage: item.coverImage || `https://picsum.photos/seed/${encodeURIComponent(item.bookId)}/480/720`,
    genre: ["List"],
    era: "Collection",
    faculty: "BCU",
    folderPath: "",
    filePath: item.filePath,
    date: item.addedAt,
    sizeBytes: 0
  };
}

function DashboardLibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);

  useEffect(() => {
    const load = async () => {
      const lists = await listReadingLists();
      const allItems = await Promise.all(lists.map((list) => listReadingListItems(list.id)));
      const merged = allItems.flat().map(toBookFromListItem);
      const unique = new Map<string, Book>();
      merged.forEach((book) => unique.set(book.id, book));
      setBooks(Array.from(unique.values()));
    };

    load().catch(() => setBooks([]));
  }, []);

  return <SimpleShelf title="Biblioteca Mea" subtitle="Documente salvate in colectiile personale." books={books} />;
}

function DashboardReadingPage() {
  const [books, setBooks] = useState<Book[]>([]);

  useEffect(() => {
    listProgress()
      .then((items) => {
        const reading = items.filter((entry) => entry.status === "reading" || (entry.percentage > 0 && entry.percentage < 100));
        setBooks(reading.map(toBookFromProgress));
      })
      .catch(() => setBooks([]));
  }, []);

  return <SimpleShelf title="In Lectura" subtitle="Continua lectura din punctul ramas." books={books} />;
}

function DashboardHistoryPage() {
  const [books, setBooks] = useState<Book[]>([]);

  useEffect(() => {
    listHistory().then((items) => setBooks(items.map(toBookFromProgress))).catch(() => setBooks([]));
  }, []);

  return <SimpleShelf title="Istoric" subtitle="Documentele accesate recent." books={books} />;
}

function DashboardWishlistPage() {
  const [books, setBooks] = useState<Book[]>([]);

  useEffect(() => {
    listWishlist().then((items) => setBooks(items.map(toBookFromProgress))).catch(() => setBooks([]));
  }, []);

  return <SimpleShelf title="Wishlist" subtitle="Documente marcate pentru mai tarziu." books={books} />;
}

function DashboardListPage() {
  const { id } = useParams<{ id: string }>();
  const [title, setTitle] = useState("Lista de lectura");
  const [books, setBooks] = useState<Book[]>([]);

  useEffect(() => {
    const listId = Number(id);
    if (!Number.isInteger(listId) || listId <= 0) {
      setBooks([]);
      return;
    }

    const load = async () => {
      const lists = await listReadingLists();
      const current = lists.find((entry) => entry.id === listId);
      if (current) {
        setTitle(current.name);
      }
      const items = await listReadingListItems(listId);
      setBooks(items.map(toBookFromListItem));
    };

    load().catch(() => setBooks([]));
  }, [id]);

  return <SimpleShelf title={title} subtitle="Documente arhivate in aceasta colectie." books={books} />;
}

function DashboardAdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [isActive, setIsActive] = useState(true);

  const resetForm = () => {
    setEditingId(null);
    setUsername("");
    setPassword("");
    setRole("user");
    setIsActive(true);
  };

  const loadUsers = async () => {
    if (user?.role !== "admin") {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const rows = await listAdminUsers();
      setUsers(rows);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nu am putut incarca utilizatorii.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers().catch(() => {
      setLoading(false);
    });
  }, [user?.role]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return users;
    }

    return users.filter((entry) => entry.username.toLowerCase().includes(term));
  }, [users, searchTerm]);

  const formatAdminDate = (value?: string) => {
    if (!value) {
      return "-";
    }

    const timestamp = Date.parse(String(value).replace(" ", "T") + "Z");
    if (Number.isNaN(timestamp)) {
      return value;
    }

    return new Intl.DateTimeFormat("ro-RO", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(timestamp));
  };

  const startEdit = (entry: AdminUser) => {
    setEditingId(entry.id);
    setUsername(entry.username);
    setPassword("");
    setRole(entry.role);
    setIsActive(entry.isActive);
    setMessage(`Editezi utilizatorul #${entry.id}`);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || user.role !== "admin" || saving) {
      return;
    }

    if (username.trim().length < 3) {
      setMessage("Username-ul trebuie sa aiba minim 3 caractere.");
      return;
    }

    if (!editingId && password.length < 8) {
      setMessage("Parola trebuie sa aiba minim 8 caractere.");
      return;
    }

    if (editingId && password && password.length < 8) {
      setMessage("Parola trebuie sa aiba minim 8 caractere.");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const payload: { username: string; role: "admin" | "user"; isActive: boolean; password?: string } = {
          username: username.trim(),
          role,
          isActive
        };
        if (password) {
          payload.password = password;
        }
        await updateAdminUser(editingId, payload);
        setMessage("Utilizator actualizat.");
      } else {
        await createAdminUser({
          username: username.trim(),
          password,
          role,
          isActive
        });
        setMessage("Utilizator creat.");
      }

      resetForm();
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Operatie esuata.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (entry: AdminUser) => {
    if (!user || user.role !== "admin") {
      return;
    }
    if (entry.id === user.id && entry.isActive) {
      setMessage("Nu poti dezactiva contul curent.");
      return;
    }

    try {
      await updateAdminUser(entry.id, {
        username: entry.username,
        role: entry.role,
        isActive: !entry.isActive
      });
      setMessage(entry.isActive ? "Utilizator dezactivat." : "Utilizator activat.");
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nu am putut actualiza statusul.");
    }
  };

  const handleDelete = async (entry: AdminUser) => {
    if (!user || user.role !== "admin") {
      return;
    }
    if (entry.id === user.id) {
      setMessage("Nu poti sterge contul curent.");
      return;
    }

    const confirmed = window.confirm(`Stergi utilizatorul ${entry.username}?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteAdminUser(entry.id);
      setMessage("Utilizator sters.");
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Stergere esuata.");
    }
  };

  if (!user || user.role !== "admin") {
    return (
      <div className="rounded-2xl border border-ink/10 bg-white p-8">
        <h1 className="text-3xl font-serif font-bold text-ink mb-3">User management</h1>
        <p className="text-ink/60 mb-6">Aceasta sectiune este disponibila doar administratorilor.</p>
        <Link to="/dashboard" className="inline-flex items-center rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 hover:border-primary hover:text-primary transition-colors">
          Inapoi in dashboard
        </Link>
      </div>
    );
  }

  const isEditingSelf = editingId === user.id;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-ink">User management</h1>
          <p className="text-ink/50">Administreaza conturile si permisiunile din platforma.</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Cauta dupa username"
            className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:border-primary"
          />
          <button
            onClick={() => loadUsers()}
            className="rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink/70 hover:border-primary hover:text-primary transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="rounded-2xl border border-ink/10 bg-white p-6 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-xs uppercase tracking-widest font-bold text-ink/40">
          Username
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="mt-2 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink focus:outline-none focus:border-primary"
            required
            minLength={3}
          />
        </label>

        <label className="text-xs uppercase tracking-widest font-bold text-ink/40">
          Parola {editingId ? "(optional la editare)" : "(obligatorie)"}
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink focus:outline-none focus:border-primary"
            placeholder="minim 8 caractere"
          />
        </label>

        <label className="text-xs uppercase tracking-widest font-bold text-ink/40">
          Rol
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as "admin" | "user")}
            className="mt-2 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink focus:outline-none focus:border-primary"
            disabled={isEditingSelf}
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-ink/40 mt-7">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            disabled={isEditingSelf}
          />
          Activ
        </label>

        <div className="md:col-span-2 flex flex-wrap items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-ink text-on-primary px-4 py-2 text-sm font-medium hover:bg-primary transition-colors disabled:opacity-60"
          >
            {editingId ? "Actualizeaza utilizator" : "Creeaza utilizator"}
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="rounded-lg border border-ink/15 px-4 py-2 text-sm text-ink/70 hover:border-primary hover:text-primary transition-colors"
          >
            Reset
          </button>
          <p className="text-sm text-ink/55">{message}</p>
        </div>
      </form>

      <div className="rounded-2xl border border-ink/10 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-ink/10 text-xs uppercase tracking-widest font-bold text-ink/40">
          Utilizatori ({filteredUsers.length})
        </div>

        {loading ? (
          <div className="p-6 text-ink/50">Se incarca utilizatorii...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-6 text-ink/50">Nu exista utilizatori pentru filtrul selectat.</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[760px] w-full border-collapse">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-widest text-ink/35 bg-surface-highest">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Activ</th>
                  <th className="px-4 py-3">Creat</th>
                  <th className="px-4 py-3">Ultimul login</th>
                  <th className="px-4 py-3">Actiuni</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((entry) => {
                  const isCurrentAdmin = entry.id === user.id;
                  return (
                    <tr key={entry.id} className="border-t border-ink/10 text-sm text-ink/75">
                      <td className="px-4 py-3">{entry.id}</td>
                      <td className="px-4 py-3 font-medium">{entry.username}</td>
                      <td className="px-4 py-3">{entry.role}</td>
                      <td className="px-4 py-3">{entry.isActive ? "Da" : "Nu"}</td>
                      <td className="px-4 py-3">{formatAdminDate(entry.createdAt)}</td>
                      <td className="px-4 py-3">{formatAdminDate(entry.lastLoginAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => startEdit(entry)}
                            className="rounded-md border border-ink/15 px-2 py-1 text-xs hover:border-primary hover:text-primary transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggle(entry)}
                            disabled={isCurrentAdmin && entry.isActive}
                            className="rounded-md border border-ink/15 px-2 py-1 text-xs hover:border-primary hover:text-primary transition-colors disabled:opacity-40"
                          >
                            {entry.isActive ? "Dezactiveaza" : "Activeaza"}
                          </button>
                          <button
                            onClick={() => handleDelete(entry)}
                            disabled={isCurrentAdmin}
                            className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 transition-colors disabled:opacity-40"
                          >
                            Sterge
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SimpleShelf({ title, subtitle, books }: { title: string; subtitle: string; books: Book[] }) {
  return (
    <div>
      <h1 className="text-3xl font-serif font-bold text-ink mb-2">{title}</h1>
      <p className="text-ink/50 font-sans mb-8">{subtitle}</p>

      {books.length === 0 ? (
        <div className="flex items-center justify-center h-[50vh] font-serif text-2xl italic opacity-30">Nu exista documente inca.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-ink text-on-primary py-24 px-6 md:px-12 border-t border-white/5">
      <div className="max-w-[1440px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16">
        <div className="space-y-8">
          <h2 className="text-3xl font-serif font-bold italic tracking-tight underline underline-offset-8 decoration-primary">Biblioteca Alternativa Cluj</h2>
          <p className="text-sm font-serif italic text-on-primary/60 leading-relaxed max-w-xs">
            Platforma digitala pentru acces la colectiile academice ale Bibliotecii Alternative Cluj.
          </p>
          <div className="flex space-x-6">
            <Twitter size={20} className="text-on-primary/40 hover:text-primary transition-colors cursor-pointer" />
            <Instagram size={20} className="text-on-primary/40 hover:text-primary transition-colors cursor-pointer" />
            <Mail size={20} className="text-on-primary/40 hover:text-primary transition-colors cursor-pointer" />
          </div>
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-[0.4em] font-bold mb-8 opacity-40">Navigation</h4>
          <ul className="space-y-4 font-sans text-xs uppercase tracking-widest font-medium">
            <li><Link to="/search" className="hover:text-primary transition-colors">Search</Link></li>
            <li><Link to="/explore" className="hover:text-primary transition-colors">Explore</Link></li>
            <li><Link to="/authors" className="hover:text-primary transition-colors">Authors</Link></li>
            <li><Link to="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-[0.4em] font-bold mb-8 opacity-40">Source</h4>
          <ul className="space-y-4 font-sans text-xs uppercase tracking-widest font-medium">
            <li><a href="https://public-view.bcucluj.ro/pdfview/" target="_blank" rel="noreferrer" className="hover:text-primary transition-colors">BCU Public View</a></li>
            <li><Link to="/search" className="hover:text-primary transition-colors">Indexed Faculties</Link></li>
            <li><Link to="/dashboard/library" className="hover:text-primary transition-colors">Saved Collections</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-[0.4em] font-bold mb-8 opacity-40">Noutati</h4>
          <p className="text-sm font-serif italic text-on-primary/50 mb-6">Aboneaza-te pentru actualizari despre colectii si servicii.</p>
          <div className="flex flex-col space-y-3">
            <input
              type="email"
              placeholder="ADRESA EMAIL"
              className="bg-white/5 border border-white/10 px-4 py-3 text-[10px] tracking-[0.2em] font-bold text-on-primary focus:outline-none focus:border-primary transition-all rounded-md"
            />
            <button className="bg-primary hover:bg-primary-container text-on-primary px-4 py-3 text-[10px] tracking-[0.3em] font-bold transition-all rounded-md">
              ABONARE
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto mt-24 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
        <p className="text-[10px] tracking-widest uppercase font-bold text-on-primary/30">© 2026 BIBLIOTECA ALTERNATIVA CLUJ. TOATE DREPTURILE REZERVATE.</p>
        <div className="flex space-x-10 text-[10px] tracking-widest uppercase font-bold text-on-primary/30">
          <span className="cursor-pointer hover:text-on-primary transition-colors">Termeni</span>
          <span className="cursor-pointer hover:text-on-primary transition-colors">Accesibilitate</span>
        </div>
      </div>
    </footer>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      {/* @ts-ignore */}
      <Routes location={location} key={location.pathname}>
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<CatalogPage />} />
          <Route path="/catalog" element={<Navigate to="/search" replace />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/book/:id" element={<BookDetailsPage />} />
          <Route path="/authors" element={<AuthorsPage />} />
        </Route>

        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardOverview />} />
          <Route path="library" element={<DashboardLibraryPage />} />
          <Route path="reading" element={<DashboardReadingPage />} />
          <Route path="history" element={<DashboardHistoryPage />} />
          <Route path="wishlist" element={<DashboardWishlistPage />} />
          <Route path="admin-users" element={<DashboardAdminUsersPage />} />
          <Route path="lists/:id" element={<DashboardListPage />} />
          <Route path="settings" element={<ProfilePage />} />
        </Route>

        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  const basename = window.location.pathname.startsWith("/app") ? "/app" : "/";

  return (
    <Router basename={basename}>
      <AnimatedRoutes />
    </Router>
  );
}
