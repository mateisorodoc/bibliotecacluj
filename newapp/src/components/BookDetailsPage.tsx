import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  X,
  PlusCircle,
  CheckCircle,
  Loader2,
  Check,
  Download
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import React from "react";
import { useAuth } from "../context/AuthContext";
import { useLibrary } from "../context/LibraryContext";
import { addReadingListItem, createReadingList, getBcuDownloadUrl, listProgress, listReadingLists, resolveFileUrl, upsertProgress } from "../lib/api";
import type { ReadingList, ReadingProgress } from "../types";
import CoverImage from "./CoverImage";

export default function BookDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { books } = useLibrary();

  const book = useMemo(() => {
    const decodeMany = (value: string, rounds = 3): string => {
      let current = String(value || "");
      for (let index = 0; index < rounds; index += 1) {
        try {
          const decoded = decodeURIComponent(current);
          if (decoded === current) {
            break;
          }
          current = decoded;
        } catch {
          break;
        }
      }
      return current;
    };

    const normalizedId = decodeMany(id || "");

    const found = books.find((entry) => {
      const variants = [
        String(entry.id || ""),
        String(entry.filePath || ""),
        decodeMany(String(entry.id || "")),
        decodeMany(String(entry.filePath || ""))
      ];

      return variants.includes(String(id || "")) || variants.includes(normalizedId);
    });
    if (found) {
      return found;
    }

    if (!id) {
      return null;
    }

    let rawPath = id;
    try {
      rawPath = decodeURIComponent(id);
    } catch {
      rawPath = id;
    }

    const fileName = rawPath.split("/").pop() || "document.pdf";
    const rawTitle = fileName.replace(/\.pdf$/i, "");
    const structured = rawTitle.match(/^([^-]+)-(.+)-((?:19|20)\d{2})$/);
    const author = structured
      ? structured[1].replace(/[_]+/g, " ").replace(/\s+/g, " ").trim()
      : "Autor necunoscut";
    const title = structured
      ? structured[2].replace(/[_]+/g, " ").replace(/\s+/g, " ").trim()
      : rawTitle.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
    const year = structured ? structured[3] : undefined;

    return {
      id,
      title,
      author,
      description: "Document incarcat dintr-o sursa externa indexului curent.",
      coverImage: "",
      genre: ["BCU"],
      era: year || "Academic Collection",
      faculty: "BCU",
      folderPath: rawPath.split("/").slice(0, -1).join("/"),
      filePath: rawPath,
      date: "-",
      sizeBytes: 0,
      publishedYear: year ? Number.parseInt(year, 10) : undefined,
      languageSource: "unknown"
    };
  }, [books, id]);

  const languageSourceLabel = useMemo(() => {
    if (!book) {
      return "Nespecificat";
    }

    if (book.languageSource === "metadata") {
      return "Metadata explicita";
    }
    if (book.languageSource === "filename") {
      return "Nume fisier";
    }
    if (book.languageSource === "inferred") {
      return "Text descriere/titlu";
    }

    return "Necunoscut";
  }, [book]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [readingLists, setReadingLists] = useState<ReadingList[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [readingStatus, setReadingStatus] = useState<ReadingProgress["status"]>("none");
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [isResolvingFile, setIsResolvingFile] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!user || !book) {
      return;
    }

    listProgress()
      .then((items) => {
        const progress = items.find((entry) => entry.bookId === book.id);
        if (progress) {
          setReadingStatus(progress.status);
        }
      })
      .catch(() => {
        setReadingStatus("none");
      });
  }, [user, book]);

  const fetchLists = async () => {
    if (!user) {
      return;
    }

    setLoadingLists(true);
    try {
      const lists = await listReadingLists();
      setReadingLists(lists);
    } finally {
      setLoadingLists(false);
    }
  };

  const handleOpenModal = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    setIsModalOpen(true);
    fetchLists();
  };

  const handleAddToList = async (listId: number) => {
    if (!book || actionLoading) {
      return;
    }

    setActionLoading(String(listId));
    try {
      await addReadingListItem(listId, {
        bookId: book.id,
        title: book.title,
        author: book.author,
        coverImage: book.coverImage,
        filePath: book.filePath
      });
      setSuccessMessage("Document adaugat in colectie.");
      setTimeout(() => {
        setIsModalOpen(false);
        setSuccessMessage(null);
      }, 1400);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateAndAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!book || !newListName.trim() || actionLoading) {
      return;
    }

    setActionLoading("new");
    try {
      const listId = await createReadingList(newListName.trim());
      await addReadingListItem(listId, {
        bookId: book.id,
        title: book.title,
        author: book.author,
        coverImage: book.coverImage,
        filePath: book.filePath
      });
      setSuccessMessage(`Colectia "${newListName}" a fost creata si actualizata.`);
      setNewListName("");
      setShowCreateInput(false);
      setTimeout(() => {
        setIsModalOpen(false);
        setSuccessMessage(null);
      }, 1500);
    } finally {
      setActionLoading(null);
    }
  };

  const setProgressState = async (status: ReadingProgress["status"], percentage: number) => {
    if (!book || !user || isStatusUpdating) {
      return;
    }

    setIsStatusUpdating(true);
    try {
      await upsertProgress(book.id, {
        title: book.title,
        status,
        percentage,
        filePath: book.filePath,
        coverImage: book.coverImage
      });
      setReadingStatus(status);
    } finally {
      setIsStatusUpdating(false);
    }
  };

  const openBookFile = async (asDownload = false) => {
    if (!book) {
      return;
    }

    setIsResolvingFile(true);

    let targetUrl = book.filePath;
    if (asDownload) {
      targetUrl = getBcuDownloadUrl(book.filePath);
    } else {
      try {
        targetUrl = await resolveFileUrl(book.filePath);
      } catch {
        targetUrl = book.filePath;
      }
    }

    setIsResolvingFile(false);

    const anchor = document.createElement("a");
    anchor.href = targetUrl;
    anchor.rel = "noopener";
    if (!asDownload) {
      anchor.target = "_blank";
    }
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  if (!book) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-6">
        <h2 className="text-3xl font-serif font-bold text-ink italic">Document indisponibil</h2>
        <p className="text-ink/60 font-sans tracking-wide">Acest document nu apare in facultatea indexata curent.</p>
        <Link to="/search" className="text-primary font-bold uppercase tracking-widest text-xs border-b border-primary/20 pb-1">
          Inapoi la Search
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-16 md:py-24">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center space-x-2 text-ink/40 hover:text-primary transition-colors mb-12 group"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Inapoi</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 md:gap-24">
        <div className="lg:col-span-5">
          <div className="rounded-2xl overflow-hidden shadow-2xl shadow-ink/10">
            <CoverImage src={book.coverImage} title={book.title} seed={book.id} className="w-full h-full object-cover aspect-[2/3]" />
          </div>
        </div>

        <div className="lg:col-span-7 space-y-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] font-bold text-primary mb-4">{book.faculty}</p>
            <h1 className="text-5xl md:text-6xl font-serif font-bold text-ink leading-[0.95] mb-5">{book.title}</h1>
            <p className="text-xl font-serif italic text-ink/60">by {book.author}</p>
          </div>

          <p className="text-ink/70 font-serif text-lg leading-relaxed">{book.description}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="p-4 rounded-xl border border-ink/10 bg-surface-low">
              <p className="text-[10px] uppercase tracking-widest font-bold text-ink/40 mb-1">Collection</p>
              <p className="font-serif text-ink">{(book.genre && book.genre[0]) || book.faculty || "BCU"}</p>
            </div>
            <div className="p-4 rounded-xl border border-ink/10 bg-surface-low">
              <p className="text-[10px] uppercase tracking-widest font-bold text-ink/40 mb-1">Departament</p>
              <p className="font-serif text-ink">{book.department || "General"}</p>
            </div>
            <div className="p-4 rounded-xl border border-ink/10 bg-surface-low">
              <p className="text-[10px] uppercase tracking-widest font-bold text-ink/40 mb-1">Date</p>
              <p className="font-serif text-ink">{book.date || "-"}</p>
            </div>
            <div className="p-4 rounded-xl border border-ink/10 bg-surface-low">
              <p className="text-[10px] uppercase tracking-widest font-bold text-ink/40 mb-1">Limba</p>
              <p className="font-serif text-ink">{book.language || "Nespecificata"}</p>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-ink/40">Sursa: {languageSourceLabel}</p>
            </div>
            <div className="p-4 rounded-xl border border-ink/10 bg-surface-low">
              <p className="text-[10px] uppercase tracking-widest font-bold text-ink/40 mb-1">An</p>
              <p className="font-serif text-ink">{book.publishedYear || book.era || "-"}</p>
            </div>
            <div className="p-4 rounded-xl border border-ink/10 bg-surface-low sm:col-span-2">
              <p className="text-[10px] uppercase tracking-widest font-bold text-ink/40 mb-1">Folder sursa</p>
              <p className="font-mono text-xs text-ink break-all">{book.folderPath || "-"}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => openBookFile(false)}
              disabled={isResolvingFile}
              className="px-6 py-3 bg-primary text-on-primary rounded-lg text-xs uppercase tracking-widest font-bold flex items-center space-x-2"
            >
              <BookOpen size={15} />
              <span>{isResolvingFile ? "Se deschide..." : "Citeste"}</span>
            </button>
            <button
              onClick={() => openBookFile(true)}
              disabled={isResolvingFile}
              className="px-6 py-3 border border-ink/15 rounded-lg text-xs uppercase tracking-widest font-bold text-ink/70 hover:text-primary flex items-center space-x-2"
            >
              <Download size={15} />
              <span>{isResolvingFile ? "Se pregateste..." : "Descarca"}</span>
            </button>
            <button
              onClick={handleOpenModal}
              className="px-6 py-3 border border-ink/15 rounded-lg text-xs uppercase tracking-widest font-bold text-ink/70 hover:text-primary flex items-center space-x-2"
            >
              <Bookmark size={15} />
              <span>Adauga in lista</span>
            </button>
          </div>

          <div className="pt-2 flex flex-wrap gap-2">
            <button
              onClick={() => setProgressState("reading", 35)}
              disabled={isStatusUpdating}
              className={`px-4 py-2 rounded-md text-[10px] uppercase tracking-widest font-bold border ${readingStatus === "reading" ? "bg-primary text-white border-primary" : "border-ink/20 text-ink/50"}`}
            >
              Marcheaza in lectura
            </button>
            <button
              onClick={() => setProgressState("completed", 100)}
              disabled={isStatusUpdating}
              className={`px-4 py-2 rounded-md text-[10px] uppercase tracking-widest font-bold border ${readingStatus === "completed" ? "bg-primary text-white border-primary" : "border-ink/20 text-ink/50"}`}
            >
              Marcheaza finalizat
            </button>
            <button
              onClick={() => setProgressState("wishlist", 0)}
              disabled={isStatusUpdating}
              className={`px-4 py-2 rounded-md text-[10px] uppercase tracking-widest font-bold border ${readingStatus === "wishlist" ? "bg-primary text-white border-primary" : "border-ink/20 text-ink/50"}`}
            >
              Adauga in wishlist
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-0">
          <div
            onClick={() => !actionLoading && setIsModalOpen(false)}
            className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
          />

          <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl p-8 max-h-[85vh] overflow-auto">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-ink/30 hover:text-ink transition-colors">
                <X size={20} />
              </button>

              <h3 className="text-2xl font-serif font-bold text-ink mb-2">Archive to Collection</h3>
              <p className="text-xs text-ink/50 font-medium mb-8">Select a collection or create a new one.</p>

              {successMessage && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center space-x-3">
                  <CheckCircle size={18} className="text-green-600" />
                  <p className="text-green-700 text-sm font-medium">{successMessage}</p>
                </div>
              )}

              <div className="space-y-3 mb-6">
                {loadingLists ? (
                  <div className="p-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-ink/30" />
                  </div>
                ) : readingLists.length > 0 ? (
                  readingLists.map((list) => (
                    <button
                      key={list.id}
                      onClick={() => handleAddToList(list.id)}
                      disabled={!!actionLoading}
                      className="w-full flex items-center justify-between p-4 bg-surface-low hover:bg-surface-highest rounded-xl transition-colors border border-ink/5 disabled:opacity-50"
                    >
                      <div className="text-left">
                        <p className="font-serif text-lg text-ink">{list.name}</p>
                        <p className="text-xs text-ink/40 uppercase tracking-wider">{list.itemCount} items</p>
                      </div>
                      {actionLoading === String(list.id) ? (
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      ) : (
                        <Check className="w-5 h-5 text-ink/20" />
                      )}
                    </button>
                  ))
                ) : (
                  <p className="text-center text-ink/40 italic py-8">No collections yet.</p>
                )}
              </div>

              <div className="border-t border-ink/10 pt-6">
                {!showCreateInput ? (
                  <button
                    onClick={() => setShowCreateInput(true)}
                    className="w-full py-3 border border-dashed border-ink/20 rounded-xl text-ink/50 hover:text-primary hover:border-primary/30 transition-all flex items-center justify-center space-x-2"
                  >
                    <PlusCircle size={18} />
                    <span className="text-xs uppercase tracking-widest font-bold">Create New Collection</span>
                  </button>
                ) : (
                  <form onSubmit={handleCreateAndAdd} className="space-y-4">
                    <input
                      autoFocus
                      type="text"
                      value={newListName}
                      onChange={(event) => setNewListName(event.target.value)}
                      placeholder="Collection name"
                      className="w-full px-4 py-3 border border-ink/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateInput(false);
                          setNewListName("");
                        }}
                        className="flex-1 py-3 text-xs uppercase tracking-widest font-bold text-ink/40 border border-ink/10 rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={actionLoading === "new" || !newListName.trim()}
                        className="flex-1 py-3 bg-ink text-on-primary rounded-xl text-xs uppercase tracking-widest font-bold disabled:opacity-50"
                      >
                        {actionLoading === "new" ? "Creating..." : "Create & Add"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
