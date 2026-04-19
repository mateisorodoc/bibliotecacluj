import {
  BookOpen,
  Library,
  Clock,
  Star,
  Settings,
  PlusCircle,
  LayoutDashboard,
  LogOut,
  X,
  Loader2,
  Users
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { createReadingList, listReadingLists } from "../lib/api";
import { motion, AnimatePresence } from "motion/react";
import type { ReadingList } from "../types";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [readingLists, setReadingLists] = useState<ReadingList[]>([]);

  const fetchLists = async () => {
    if (!user) {
      setReadingLists([]);
      return;
    }

    try {
      const lists = await listReadingLists();
      setReadingLists(lists);
    } catch {
      setReadingLists([]);
    }
  };

  useEffect(() => {
    fetchLists();
  }, [user]);

  const handleCreateList = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !newListName.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await createReadingList(newListName.trim());
      setNewListName("");
      setIsCreating(false);
      await fetchLists();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const menuItems = [
    { label: "Panou", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Biblioteca mea", icon: Library, path: "/dashboard/library" },
    { label: "In lectura", icon: BookOpen, path: "/dashboard/reading" },
    { label: "Istoric", icon: Clock, path: "/dashboard/history" },
    { label: "Wishlist", icon: Star, path: "/dashboard/wishlist" },
    ...(user?.role === "admin" ? [{ label: "User management", icon: Users, path: "/dashboard/admin-users" }] : [])
  ];

  const createListModal = (
    <AnimatePresence>
      {isCreating ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 sm:p-0">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isSubmitting && setIsCreating(false)}
            className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-sm glass-panel p-8 rounded-3xl border border-white/40 shadow-2xl bg-white"
          >
            <button
              onClick={() => setIsCreating(false)}
              className="absolute top-4 right-4 text-ink/30 hover:text-ink transition-colors"
            >
              <X size={20} />
            </button>

            <h3 className="text-xl font-serif font-bold text-ink mb-2">Colectie noua</h3>
            <p className="text-xs text-ink/50 font-medium mb-8">Organizeaza documentele in rafturi personale.</p>

            <form onSubmit={handleCreateList} className="space-y-6">
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-ink/40 ml-1 block mb-2">Nume colectie</label>
                <input
                  autoFocus
                  type="text"
                  value={newListName}
                  onChange={(event) => setNewListName(event.target.value)}
                  placeholder="ex: Bibliografie semestru"
                  disabled={isSubmitting}
                  className="w-full bg-surface-highest/50 border border-ink/5 px-4 py-3 rounded-xl font-serif text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-ink/20"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 px-4 py-3 text-xs uppercase tracking-widest font-bold text-ink/40 hover:text-ink transition-colors"
                >
                  Anuleaza
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newListName.trim()}
                  className="flex-1 bg-ink text-on-primary py-3 rounded-xl font-sans text-[10px] uppercase tracking-widest font-bold flex items-center justify-center space-x-2 hover:bg-primary disabled:opacity-50 transition-all shadow-lg shadow-ink/10"
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <span>Creeaza lista</span>}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );

  return (
    <aside className="w-64 flex-shrink-0 sticky top-32 h-[calc(100vh-160px)] px-4">
      <div className="space-y-1">
        <p className="px-4 text-[10px] uppercase tracking-[0.2em] font-bold text-ink/30 mb-4">Panou utilizator</p>
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/dashboard"}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all group ${
                isActive
                  ? "bg-primary text-on-primary shadow-lg shadow-primary/20"
                  : "text-ink/50 hover:bg-surface-highest hover:text-ink"
              }`
            }
          >
            <item.icon size={18} strokeWidth={1.5} className="flex-shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>

      <div className="mt-12 space-y-1">
        <p className="px-4 text-[10px] uppercase tracking-[0.2em] font-bold text-ink/30 mb-4">Liste de lectura</p>

        <div className="space-y-1 mb-4 max-h-56 overflow-auto pr-1">
          {readingLists.map((list) => (
            <NavLink
              key={list.id}
              to={`/dashboard/lists/${list.id}`}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-surface-highest text-primary"
                    : "text-ink/60 hover:bg-surface-highest/50 hover:text-ink"
                }`
              }
            >
              <div className="w-1.5 h-1.5 rounded-full bg-ink/10" />
              <span className="truncate">{list.name}</span>
              <span className="ml-auto text-[10px] text-ink/30">{list.itemCount}</span>
            </NavLink>
          ))}
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium text-ink/50 hover:text-primary group transition-colors"
        >
          <PlusCircle size={18} strokeWidth={1.5} className="text-ink/30 group-hover:text-primary transition-colors" />
          <span>Colectie noua</span>
        </button>
      </div>

      {typeof document !== "undefined" ? createPortal(createListModal, document.body) : null}

      <div className="absolute bottom-4 left-0 w-full px-4 space-y-2">
        <NavLink
          to="/dashboard/settings"
          className="flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium text-ink/50 hover:bg-surface-highest hover:text-ink transition-all"
        >
          <Settings size={18} strokeWidth={1.5} />
          <span>Setari profil</span>
        </NavLink>
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium text-ink/50 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer"
        >
          <LogOut size={18} strokeWidth={1.5} />
          <span>Delogare</span>
        </button>
      </div>
    </aside>
  );
}
