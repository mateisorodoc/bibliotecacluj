import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getProfile, updateProfile } from "../lib/api";
import { motion } from "motion/react";
import { User, Save, CheckCircle, AlertCircle } from "lucide-react";

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
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
        bio: bio.trim()
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="max-w-2xl mx-auto"
    >
      <div className="mb-12">
        <h1 className="text-3xl font-serif font-bold text-ink mb-2">Account Sanctuary</h1>
        <p className="text-ink/50 font-sans font-medium italic">Refine your identity in this BCU-powered archive.</p>
      </div>

      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-white/40 shadow-xl shadow-ink/5">
        <form onSubmit={handleSave} className="space-y-8">
          <div className="flex flex-col items-center space-y-5">
            <div className="w-32 h-32 rounded-full overflow-hidden border-8 border-white shadow-2xl bg-surface-highest flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User size={58} className="text-ink/10" strokeWidth={1} />
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-ink/40 ml-1 block mb-2">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="w-full bg-white border border-ink/10 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Your display name"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-ink/40 ml-1 block mb-2">Avatar URL</label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
                className="w-full bg-white border border-ink/10 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                placeholder="Describe your academic interests..."
              />
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
            className="w-full bg-ink text-on-primary py-4 rounded-xl font-sans text-xs uppercase tracking-widest font-bold flex items-center justify-center space-x-3 hover:bg-primary transition-all shadow-lg shadow-ink/10 disabled:opacity-50"
          >
            <Save size={16} strokeWidth={1.8} />
            <span>{saving ? "Saving..." : "Save Profile"}</span>
          </button>
        </form>
      </div>
    </motion.div>
  );
}
