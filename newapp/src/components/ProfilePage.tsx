import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getProfile, updateProfile } from "../lib/api";
import { User, Save, CheckCircle, AlertCircle, Mail } from "lucide-react";

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [kindleEmail, setKindleEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    getProfile()
      .then((profile) => {
        setDisplayName(profile.displayName || "");
        setAvatarUrl(profile.avatarUrl || "");
        setBio(profile.bio || "");
        setKindleEmail(profile.kindleEmail || "");
      })
      .catch(() => {
        setDisplayName(user.displayName || user.username);
        setAvatarUrl(user.avatarUrl || "");
        setBio(user.bio || "");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!displayName.trim()) {
      setMessage({ type: "error", text: "Display name cannot be empty." });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await updateProfile({
        displayName: displayName.trim(),
        avatarUrl: avatarUrl.trim(),
        bio: bio.trim(),
        kindleEmail: kindleEmail.trim()
      });
      await refreshUser();
      setMessage({ type: "success", text: "Profile updated successfully." });
    } catch (error) {
      const text = error instanceof Error ? error.message : "Failed to update profile.";
      setMessage({ type: "error", text });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-1 sm:px-2">
      <div className="mb-8 md:mb-12 px-2 sm:px-0">
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-ink mb-2">Setari Profil</h1>
        <p className="text-ink/50 text-sm sm:text-base font-sans font-medium italic">Actualizeaza informatiile contului pentru o experienta mai buna.</p>
      </div>

      <div className="glass-panel p-4 sm:p-6 md:p-10 rounded-2xl md:rounded-3xl border border-white/40 shadow-xl shadow-ink/5">
        <form onSubmit={handleSave} className="space-y-6 md:space-y-8">
          <div className="flex flex-col items-center space-y-4 md:space-y-5">
            <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full overflow-hidden border-4 sm:border-6 md:border-8 border-white shadow-xl bg-surface-highest flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User size={42} className="text-ink/10" strokeWidth={1} />
              )}
            </div>
          </div>

          <div className="space-y-5 md:space-y-6">
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-ink/40 ml-1 block mb-2">Nume afisat</label>
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="w-full min-h-[44px] bg-white border border-ink/10 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Numele tau afisat"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-ink/40 ml-1 block mb-2">Avatar URL</label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
                className="w-full min-h-[44px] bg-white border border-ink/10 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-ink/40 ml-1 block mb-2">Bio</label>
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                rows={4}
                className="w-full bg-white border border-ink/10 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Descrie interesele tale academice..."
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-ink/40 ml-1 block mb-2">Kindle Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30 pointer-events-none" />
                <input
                  type="email"
                  value={kindleEmail}
                  onChange={(event) => setKindleEmail(event.target.value)}
                  className="w-full min-h-[44px] bg-white border border-ink/10 pl-9 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="username@kindle.com"
                />
              </div>
              <p className="mt-1.5 text-[10px] text-ink/40 ml-1">Adresa de email a dispozitivului Kindle, pentru functia Send to Kindle.</p>
            </div>
          </div>

          {message ? (
            <div className={`p-4 rounded-xl flex items-center space-x-3 ${message.type === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
              {message.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              <p className="text-sm font-medium">{message.text}</p>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[46px] bg-ink text-on-primary py-3.5 rounded-xl font-sans text-xs uppercase tracking-widest font-bold flex items-center justify-center space-x-3 hover:bg-primary transition-all shadow-lg shadow-ink/10 disabled:opacity-50"
          >
            <Save size={16} strokeWidth={1.8} />
            <span>{saving ? "Se salveaza..." : "Salveaza profilul"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
