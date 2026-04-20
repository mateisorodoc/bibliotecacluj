import { Link, useNavigate, useLocation } from "react-router-dom";
import { LogIn, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";

type LocationState = { from?: { pathname?: string } };

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as LocationState | null)?.from?.pathname || "/dashboard";

  useEffect(() => {
    if (user && !loading) {
      navigate(from, { replace: true });
    }
  }, [user, loading, navigate, from]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError("Username si parola sunt obligatorii.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Autentificare esuata.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-md w-full bg-white p-12 rounded-[2rem] shadow-2xl shadow-ink/5 border border-ink/5">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-8 mx-auto">
          <ShieldCheck size={40} strokeWidth={1} />
        </div>

        <h1 className="text-4xl font-serif font-bold text-ink mb-4 text-center">Autentificare</h1>
        <p className="text-ink/60 font-serif italic text-lg mb-10 leading-relaxed text-center">
          Biblioteca Alternativa Cluj
        </p>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-ink/40 mb-2 block">
              Utilizator
            </label>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full bg-surface-highest/50 border border-ink/10 px-4 py-3 rounded-xl font-sans text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="admin"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-ink/40 mb-2 block">
              Parola
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full bg-surface-highest/50 border border-ink/10 px-4 py-3 rounded-xl font-sans text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="********"
              autoComplete="current-password"
            />
          </div>

          {error ? (
            <p className="text-xs font-bold uppercase tracking-wider text-red-600">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-ink text-on-primary py-5 rounded-2xl font-sans text-xs uppercase tracking-[0.3em] font-bold flex items-center justify-center space-x-4 hover:bg-primary transition-all active:scale-[0.98] shadow-lg shadow-ink/20 disabled:opacity-60"
          >
            <LogIn size={18} strokeWidth={1.5} />
            <span>{submitting ? "Se autentifica..." : "Intra in cont"}</span>
          </button>
        </form>

        <div className="mt-8 pt-5 border-t border-ink/10 text-sm text-center text-ink/55">
          Ai primit un link de invitatie?
          <br />
          <span className="text-ink/45">Deschide link-ul primit pentru a crea contul si a trimite cererea de aprobare.</span>
          <div className="mt-3">
            <Link to="/" className="text-primary font-semibold hover:opacity-80">Inapoi la pagina principala</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
