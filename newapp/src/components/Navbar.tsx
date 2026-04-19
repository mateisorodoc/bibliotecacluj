import { Menu, X, LogOut, User as UserIcon } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navLinks = [
    { name: "Search", path: "/search" },
    { name: "Explore", path: "/explore" },
    { name: "Contul meu", path: "/dashboard" }
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <>
      <nav className="frosted-nav sticky top-0 w-full z-50 shadow-sm shadow-ink/5">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-12 py-4 md:py-5 flex justify-between items-center gap-3">
          <Link to="/" className="text-lg sm:text-2xl font-serif font-semibold text-ink italic tracking-tight hover:opacity-80 transition-opacity leading-tight">
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

          <div className="flex items-center space-x-4 md:space-x-6">
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
                    {user.pendingInviteRequests && user.pendingInviteRequests > 0
                      ? `User management (${user.pendingInviteRequests})`
                      : "User management"}
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

            <button className="md:hidden text-ink p-1" onClick={() => setIsOpen(!isOpen)} aria-label="Deschide meniul">
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
              className="md:hidden absolute top-full left-0 w-full bg-surface-low border-t border-ink/5 p-5 space-y-4 shadow-xl"
            >
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={`block font-sans text-base uppercase tracking-widest ${
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
                  className={`block font-sans text-base uppercase tracking-widest ${
                    isActive("/dashboard/admin-users") ? "text-primary font-bold" : "text-ink/60 font-medium"
                  }`}
                >
                  {user.pendingInviteRequests && user.pendingInviteRequests > 0
                    ? `User management (${user.pendingInviteRequests})`
                    : "User management"}
                </Link>
              ) : null}
              <Link
                to={user ? "/dashboard/settings" : "/login"}
                onClick={() => setIsOpen(false)}
                className="block font-sans text-base uppercase tracking-widest text-primary font-bold pt-4"
              >
                {user ? "Profilul meu" : "Autentificare"}
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  );
}
