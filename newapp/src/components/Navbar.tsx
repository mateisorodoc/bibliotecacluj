import { Search, Menu, X, ArrowRight, LogOut, User as UserIcon } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../context/AuthContext";
import { useLibrary } from "../context/LibraryContext";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { user, logout } = useAuth();
  const { books, setSearchQuery: setGlobalSearch } = useLibrary();
  const location = useLocation();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const navLinks = [
    { name: "Search", path: "/search" },
    { name: "Explore", path: "/explore" },
    { name: "Autori", path: "/authors" },
    { name: "Contul meu", path: "/dashboard" }
  ];

  const isActive = (path: string) => location.pathname === path;

  const matches = searchQuery.trim() === ""
    ? []
    : books.filter((book) =>
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.genre.some((genre) => genre.toLowerCase().includes(searchQuery.toLowerCase()))
      );

  const filteredResults = matches.slice(0, 8);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSearchOpen(false);
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <>
      <nav className="frosted-nav sticky top-0 w-full z-50 shadow-sm shadow-ink/5">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-5 flex justify-between items-center">
          <Link to="/" className="text-2xl font-serif font-semibold text-ink italic tracking-tight hover:opacity-80 transition-opacity">
            Biblioteca Alternativa Cluj
          </Link>

          <div className="hidden md:flex items-center space-x-10">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`font-sans text-sm uppercase tracking-widest transition-all hover:text-primary ${
                  isActive(link.path) ? "text-primary font-bold border-b border-primary/20 pb-1" : "text-ink/60 font-medium"
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          <div className="flex items-center space-x-6">
            <button
              className="text-ink/60 hover:text-primary transition-colors cursor-pointer"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search size={22} strokeWidth={1.5} />
            </button>

            {user ? (
              <div className="hidden md:flex items-center space-x-5 px-3 py-1.5 bg-surface-highest rounded-full border border-ink/5">
                <Link to="/dashboard/settings" className="flex items-center space-x-3 pr-2 border-r border-ink/10 hover:opacity-70 transition-opacity">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} className="w-7 h-7 rounded-full shadow-sm" alt="Profile" />
                  ) : (
                    <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                      <UserIcon size={14} />
                    </div>
                  )}
                  <span className="text-[10px] uppercase tracking-widest font-bold text-ink/60 truncate max-w-[100px]">
                    {(user.displayName || user.username).split(" ")[0]}
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-ink/40 hover:text-primary transition-colors cursor-pointer"
                  title="Logout"
                >
                  <LogOut size={16} strokeWidth={1.5} />
                </button>
                {user.role === "admin" ? (
                  <Link to="/dashboard/admin-users" className="text-[10px] uppercase tracking-widest font-bold text-primary hover:opacity-80">
                    User management
                  </Link>
                ) : null}
              </div>
            ) : (
              <Link
                to="/login"
                className="hidden md:block font-sans text-xs uppercase tracking-widest font-bold px-6 py-2.5 bg-primary text-on-primary rounded-md hover:bg-primary-container transition-transform active:scale-95"
              >
                Autentificare
              </Link>
            )}

            <button className="md:hidden text-ink" onClick={() => setIsOpen(!isOpen)}>
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="md:hidden absolute top-full left-0 w-full bg-surface-low border-t border-ink/5 p-6 space-y-4 shadow-xl"
            >
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={`block font-sans text-lg uppercase tracking-widest ${
                    isActive(link.path) ? "text-primary font-bold" : "text-ink/60 font-medium"
                  }`}
                >
                  {link.name}
                </Link>
              ))}
              {user?.role === "admin" ? (
                <Link
                  to="/dashboard/admin-users"
                  onClick={() => setIsOpen(false)}
                  className={`block font-sans text-lg uppercase tracking-widest ${
                    isActive("/dashboard/admin-users") ? "text-primary font-bold" : "text-ink/60 font-medium"
                  }`}
                >
                  User management
                </Link>
              ) : null}
              <Link
                to={user ? "/dashboard/settings" : "/login"}
                onClick={() => setIsOpen(false)}
                className="block font-sans text-lg uppercase tracking-widest text-primary font-bold pt-4"
              >
                {user ? "Profilul meu" : "Autentificare"}
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-ink/95 backdrop-blur-xl flex flex-col items-center pt-32 px-6"
          >
            <button
              className="absolute top-8 right-8 md:right-16 text-on-primary/60 hover:text-on-primary transition-colors"
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery("");
              }}
            >
              <X size={32} strokeWidth={1.5} />
            </button>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="w-full max-w-2xl"
            >
              <div className="relative mb-12">
                <Search size={24} className="absolute left-0 top-1/2 -translate-y-1/2 text-primary" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="SEARCH ALTERNATIVE CLUJ BOOKS..."
                  value={searchQuery}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSearchQuery(value);
                    setGlobalSearch(value);
                  }}
                  className="w-full bg-transparent border-b border-on-primary/20 py-4 pl-10 pr-4 text-2xl md:text-3xl font-serif text-on-primary focus:outline-none focus:border-primary transition-all placeholder:text-on-primary/20 uppercase tracking-tight"
                />
              </div>

              <div className="space-y-3 max-h-[50vh] overflow-auto pr-2">
                {filteredResults.map((book) => (
                  <Link
                    key={book.id}
                    to={`/book/${encodeURIComponent(book.id)}`}
                    onClick={() => {
                      setIsSearchOpen(false);
                      setSearchQuery("");
                    }}
                    className="block border border-white/10 rounded-lg p-4 hover:border-primary/40 hover:bg-white/5 transition-all"
                  >
                    <p className="font-serif text-xl text-on-primary leading-tight">{book.title}</p>
                    <p className="text-on-primary/50 text-xs uppercase tracking-widest mt-2">
                      {book.author} · {book.faculty}
                    </p>
                  </Link>
                ))}

                {searchQuery.trim() && filteredResults.length === 0 ? (
                  <div className="text-on-primary/50 text-sm italic">Nu exista rezultate in indexul curent.</div>
                ) : null}

                {!searchQuery.trim() ? (
                  <div className="text-on-primary/50 text-sm italic">Scrie un titlu, autor sau domeniu pentru cautare.</div>
                ) : null}
              </div>

              <div className="mt-8">
                <Link
                  to="/search"
                  onClick={() => setIsSearchOpen(false)}
                  className="inline-flex items-center text-xs uppercase tracking-widest font-bold text-primary hover:text-primary-container"
                >
                  Open full search <ArrowRight size={14} className="ml-2" />
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
