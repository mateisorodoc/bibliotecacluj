import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Loader2, UserPlus2 } from "lucide-react";
import { getInviteInfo, registerFromInvite } from "../lib/api";

function formatInviteDate(value?: string | null): string {
  if (!value) {
    return "fara expirare";
  }

  const timestamp = Date.parse(String(value).replace(" ", "T") + "Z");
  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

export default function InviteRegistrationPage() {
  const { token = "" } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<{ maxUses: number; usesCount: number; expiresAt?: string | null } | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setInviteError("Link-ul de invitatie este invalid.");
      setLoading(false);
      return;
    }

    setLoading(true);
    getInviteInfo(token)
      .then((info) => {
        setInviteInfo({ maxUses: info.maxUses, usesCount: info.usesCount, expiresAt: info.expiresAt });
        setInviteError(null);
      })
      .catch((err) => {
        setInviteError(err instanceof Error ? err.message : "Link-ul de invitatie nu este valid.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const availableSlots = useMemo(() => {
    if (!inviteInfo) {
      return 0;
    }

    if (inviteInfo.maxUses <= 0) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.max(0, inviteInfo.maxUses - inviteInfo.usesCount);
  }, [inviteInfo]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || submitting) {
      return;
    }

    if (!username.trim() || username.trim().length < 3) {
      setError("Username-ul trebuie sa aiba minim 3 caractere.");
      return;
    }

    if (password.length < 8) {
      setError("Parola trebuie sa aiba minim 8 caractere.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Parolele nu coincid.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const responseMessage = await registerFromInvite(token, username.trim(), password);
      setMessage(responseMessage || "Cererea de inregistrare a fost trimisa. Asteapta aprobarea unui admin.");
      setUsername("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut trimite cererea.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full bg-white p-10 sm:p-12 rounded-[2rem] shadow-2xl shadow-ink/5 border border-ink/5"
      >
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-6 mx-auto">
          <UserPlus2 size={38} strokeWidth={1.2} />
        </div>

        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-ink text-center mb-3">Invitatie noua</h1>
        <p className="text-center text-ink/60 font-serif italic mb-8">Creeaza-ti contul si asteapta aprobarea administratorului.</p>

        {loading ? (
          <div className="py-8 text-center text-ink/50">
            <Loader2 className="mx-auto mb-3 animate-spin" />
            Se valideaza invitatia...
          </div>
        ) : inviteError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-8">
            {inviteError}
          </div>
        ) : (
          <>
            <div className="mb-8 rounded-xl border border-ink/10 bg-surface-low px-4 py-3 text-sm text-ink/60">
              <p>Expira: {formatInviteDate(inviteInfo?.expiresAt)}</p>
              <p className="mt-1">
                Sloturi ramase: {availableSlots === Number.POSITIVE_INFINITY ? "nelimitat" : String(availableSlots)}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-[10px] uppercase tracking-widest font-bold text-ink/40">
                Username
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="mt-2 w-full bg-surface-highest/50 border border-ink/10 px-4 py-3 rounded-xl font-sans text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoComplete="username"
                />
              </label>

              <label className="block text-[10px] uppercase tracking-widest font-bold text-ink/40">
                Parola
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full bg-surface-highest/50 border border-ink/10 px-4 py-3 rounded-xl font-sans text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoComplete="new-password"
                />
              </label>

              <label className="block text-[10px] uppercase tracking-widest font-bold text-ink/40">
                Confirma parola
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="mt-2 w-full bg-surface-highest/50 border border-ink/10 px-4 py-3 rounded-xl font-sans text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoComplete="new-password"
                />
              </label>

              {error ? <p className="text-xs font-bold uppercase tracking-wide text-red-600">{error}</p> : null}

              {message ? (
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex items-start gap-2">
                  <CheckCircle2 size={18} className="mt-0.5" />
                  <span>{message}</span>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-ink text-on-primary py-4 rounded-2xl font-sans text-xs uppercase tracking-[0.25em] font-bold flex items-center justify-center gap-3 hover:bg-primary transition-all disabled:opacity-60"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                <span>{submitting ? "Se trimite..." : "Trimite cererea"}</span>
              </button>
            </form>
          </>
        )}

        <div className="mt-8 pt-5 border-t border-ink/10 text-sm text-ink/55 text-center">
          Ai deja cont?{" "}
          <Link to="/login" className="text-primary font-semibold hover:opacity-80">
            Autentifica-te
          </Link>
          {message ? (
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="ml-3 text-ink/50 underline decoration-ink/30 hover:text-primary"
            >
              Mergi la login
            </button>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
