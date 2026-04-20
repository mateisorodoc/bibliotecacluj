import { Menu, X, LogOut, User as UserIcon, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type NavbarProps = {
  themeMode: "light" | "dark";
  onToggleTheme: () => void;
};

export default function Navbar({ themeMode, onToggleTheme }: NavbarProps) {
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
            {user && navLinks.map((link) => (
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
            <button
              type="button"
              onClick={onToggleTheme}
              className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-surface-low px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold text-ink/70 hover:border-primary hover:text-primary transition-colors"
              aria-label={themeMode === "dark" ? "Comuta pe tema deschisa" : "Comuta pe tema inchisa"}
              title={themeMode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {themeMode === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              <span className="hidden md:inline">{themeMode === "dark" ? "Light" : "Dark"}</span>
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

        {isOpen && (
            <div className="md:hidden absolute top-full left-0 w-full bg-surface-low border-t border-ink/5 p-5 space-y-4 shadow-xl">
              {user && navLinks.map((link) => (
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
              <button
                type="button"
                onClick={() => {
                  onToggleTheme();
                  setIsOpen(false);
                }}
                className="block w-full text-left font-sans text-base uppercase tracking-widest text-ink/70 font-medium"
              >
                {themeMode === "dark" ? "Tema deschisa" : "Tema inchisa"}
              </button>
              <Link
                to={user ? "/dashboard/settings" : "/login"}
                onClick={() => setIsOpen(false)}
                className="block font-sans text-base uppercase tracking-widest text-primary font-bold pt-4"
              >
                {user ? "Profilul meu" : "Autentificare"}
              </Link>
            </div>
          )}
      </nav>
    </>
  );
}
