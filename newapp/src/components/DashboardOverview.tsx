import { ArrowRight, Clock, Star, TrendingUp, ListChecks, Link2, BellRing } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { createInviteLink, getDashboardSummary, getPendingInviteRequestCount, listMyInvites, resolveFileUrl } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useLibrary } from "../context/LibraryContext";
import type { InviteLink, ReadingProgress } from "../types";
import CoverImage from "./CoverImage";

export default function DashboardOverview() {
  const { user } = useAuth();
  const { books } = useLibrary();
  const [summary, setSummary] = useState({
    completedCount: 0,
    readingCount: 0,
    wishlistCount: 0,
    trackedCount: 0,
    listCount: 0
  });
  const [recent, setRecent] = useState<ReadingProgress[]>([]);
  const [opening, setOpening] = useState(false);
  const [invites, setInvites] = useState<InviteLink[]>([]);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);

  useEffect(() => {
    getDashboardSummary()
      .then((payload) => {
        setSummary(payload.summary);
        setRecent(payload.recent);
      })
      .catch(() => {
        setSummary({ completedCount: 0, readingCount: 0, wishlistCount: 0, trackedCount: 0, listCount: 0 });
        setRecent([]);
      });
  }, []);

  useEffect(() => {
    listMyInvites()
      .then((rows) => setInvites(rows.slice(0, 5)))
      .catch(() => setInvites([]));
  }, []);

  useEffect(() => {
    if (user?.role !== "admin") {
      setPendingInviteCount(0);
      return;
    }

    getPendingInviteRequestCount()
      .then((count) => setPendingInviteCount(count))
      .catch(() => setPendingInviteCount(0));
  }, [user?.role]);

  const stats = [
    { label: "Documente finalizate", value: String(summary.completedCount), icon: TrendingUp },
    { label: "In lectura", value: String(summary.readingCount), icon: Clock },
    { label: "Wishlisted", value: String(summary.wishlistCount), icon: Star },
    { label: "Colectii", value: String(summary.listCount), icon: ListChecks }
  ];

  const inviteLimitReached = invites.length >= 2;

  const recentBooks = useMemo(() => {
    const mapped = recent
      .map((item) => books.find((book) => book.id === item.bookId))
      .filter(Boolean);

    if (mapped.length > 0) {
      return mapped.slice(0, 3);
    }

    return books.slice(0, 3);
  }, [books, recent]);

  const currentRead = useMemo(() => {
    const reading = recent.find((item) => item.status === "reading" || (item.percentage > 0 && item.percentage < 100));
    if (!reading) {
      return books[0] || null;
    }

    return books.find((book) => book.id === reading.bookId) || books[0] || null;
  }, [books, recent]);

  const handleContinueReading = async () => {
    if (!currentRead || opening) {
      return;
    }

    setOpening(true);
    try {
      const resolved = await resolveFileUrl(currentRead.filePath);
      window.open(resolved, "_blank", "noopener");
    } catch {
      window.open(currentRead.filePath, "_blank", "noopener");
    } finally {
      setOpening(false);
    }
  };

  const handleCreateInvite = async () => {
    if (inviteBusy) {
      return;
    }

    if (inviteLimitReached) {
      setInviteMessage("Ai atins limita de 2 linkuri de invitatie per utilizator.");
      return;
    }

    setInviteBusy(true);
    setInviteMessage(null);
    try {
      const created = await createInviteLink({ maxUses: 1, expiresInDays: 14 });
      setInvites((current) => [created, ...current].slice(0, 5));
      setInviteMessage("Link de invitatie creat. L-am copiat in clipboard.");
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(created.inviteUrl);
      }
    } catch (error) {
      setInviteMessage(error instanceof Error ? error.message : "Nu am putut crea invitatia.");
    } finally {
      setInviteBusy(false);
    }
  };

  const handleCopyInvite = async (invite: InviteLink) => {
    try {
      await navigator.clipboard.writeText(invite.inviteUrl);
      setInviteMessage("Link copiat.");
    } catch {
      setInviteMessage("Clipboard indisponibil. Copiaza manual link-ul.");
    }
  };

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-3xl font-serif font-bold text-ink mb-1">Bine ai revenit in Biblioteca Alternativa Cluj</h1>
        <p className="text-ink/50 font-sans font-medium">Colectiile tale sunt sincronizate cu indexul universitar.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
            className="glass-panel p-6 rounded-2xl border border-ink/5 flex items-center justify-between shadow-sm"
          >
            <div>
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-ink/40 mb-1">{stat.label}</p>
              <p className="text-2xl font-serif font-bold text-ink">{stat.value}</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-xl text-primary">
              <stat.icon size={24} strokeWidth={1.5} />
            </div>
          </motion.div>
        ))}
      </div>

      {user?.role === "admin" && pendingInviteCount > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-amber-800">
            <BellRing size={18} />
            <p className="text-sm font-medium">Ai {pendingInviteCount} cereri de inregistrare in asteptare.</p>
          </div>
          <Link to="/dashboard/admin-users" className="text-xs uppercase tracking-widest font-bold text-amber-800 hover:opacity-80">
            Revizuire cereri
          </Link>
        </div>
      ) : null}

      <div className="rounded-2xl border border-ink/10 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-serif font-bold text-ink">Invita utilizatori noi</h3>
            <p className="text-sm text-ink/55">Fiecare utilizator poate genera maximum 2 linkuri, iar fiecare link poate fi folosit o singura data.</p>
          </div>
          <button
            onClick={handleCreateInvite}
            disabled={inviteBusy || inviteLimitReached}
            className="rounded-lg bg-ink px-4 py-2 text-xs uppercase tracking-widest font-bold text-on-primary hover:bg-primary transition-colors disabled:opacity-60"
          >
            {inviteBusy ? "Se creeaza..." : (inviteLimitReached ? "Limita atinsa" : "Genereaza link")}
          </button>
        </div>

        {inviteMessage ? <p className="text-sm text-ink/65">{inviteMessage}</p> : null}

        {invites.length === 0 ? (
          <p className="text-sm text-ink/45">Nu ai invitatii generate inca.</p>
        ) : (
          <div className="space-y-2">
            {invites.map((invite) => (
              <div key={invite.id} className="rounded-lg border border-ink/10 bg-surface-low px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-ink/70 truncate flex items-center gap-2">
                    <Link2 size={12} />
                    {invite.inviteUrl}
                  </p>
                  <p className="text-[11px] text-ink/45 mt-1">Utilizari: {invite.usesCount}/{invite.maxUses}</p>
                </div>
                <button
                  onClick={() => handleCopyInvite(invite)}
                  className="rounded-md border border-ink/15 px-3 py-1 text-xs text-ink/70 hover:border-primary hover:text-primary transition-colors"
                >
                  Copiaza
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {currentRead ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-panel p-8 rounded-3xl border border-ink/5 shadow-xl relative overflow-hidden group"
        >
          <div className="flex flex-col md:flex-row gap-8 relative z-10">
            <div className="w-32 md:w-48 flex-shrink-0 shadow-2xl rounded-lg overflow-hidden transform group-hover:scale-105 transition-transform duration-500">
              <CoverImage
                src={currentRead.coverImage}
                title={currentRead.title}
                seed={currentRead.id}
                className="w-full h-full object-cover aspect-[2/3]"
              />
            </div>

            <div className="flex-1 flex flex-col justify-center">
              <div className="flex items-center space-x-2 text-primary font-bold text-[10px] uppercase tracking-widest mb-3">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <span>In lectura</span>
              </div>
              <h2 className="text-3xl font-serif font-bold text-ink mb-2 leading-tight">{currentRead.title}</h2>
              <p className="font-serif italic text-ink/60 text-lg mb-6 leading-relaxed">by {currentRead.author}</p>

              <div className="mt-2 flex space-x-4">
                <button
                  onClick={handleContinueReading}
                  disabled={opening}
                  className="px-6 py-3 bg-primary text-on-primary font-sans text-xs uppercase tracking-[0.2em] font-bold rounded-lg hover:bg-primary-container transition-all active:scale-95"
                >
                  {opening ? "Se deschide..." : "Continua lectura"}
                </button>
                <Link
                  to={`/book/${encodeURIComponent(currentRead.id)}`}
                  className="px-6 py-3 border border-ink/10 text-ink/60 font-sans text-xs uppercase tracking-[0.2em] font-bold rounded-lg hover:bg-surface-highest transition-all flex items-center"
                >
                  Detalii document
                </Link>
              </div>
            </div>
          </div>

          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50" />
        </motion.div>
      ) : null}

      <div>
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-serif font-bold text-ink uppercase tracking-wider">Accesate recent</h3>
          <Link to="/search" className="group flex items-center space-x-2 text-xs uppercase tracking-widest font-bold text-ink/40 hover:text-primary transition-colors">
            <span>Vezi toate</span>
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {recentBooks.map((book, idx) => (
            <motion.div
              key={book.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 + 0.3 }}
              className="group cursor-pointer"
            >
              <Link to={`/book/${encodeURIComponent(book.id)}`}>
                <div className="aspect-[3/4] rounded-2xl overflow-hidden mb-5 shadow-lg group-hover:shadow-2xl transition-all duration-500 relative">
                  <CoverImage
                    src={book.coverImage}
                    title={book.title}
                    seed={book.id}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                    <div className="text-on-primary transform translate-y-4 group-hover:translate-y-0 transition-transform font-sans text-[10px] uppercase tracking-widest font-bold flex items-center">
                      Deschide <ArrowRight size={14} className="ml-2" />
                    </div>
                  </div>
                </div>
                <h4 className="font-serif text-lg font-bold text-ink leading-tight mb-1 group-hover:text-primary transition-colors">{book.title}</h4>
                <p className="font-serif italic text-ink/50 text-sm">{book.author}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
