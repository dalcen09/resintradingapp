import { useState } from "react";
import { login } from "@/lib/auth";

interface Props {
  onSuccess: () => void;
}

export function LoginPage({ onSuccess }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(password);
      onSuccess();
    } catch {
      setError("パスワードが正しくありません");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.bg}>
      <div style={styles.card}>
        <h1 style={styles.title}>ログイン</h1>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>パスワード</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={styles.input}
            placeholder="••••••••"
            autoFocus
          />
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? "処理中..." : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bg: { minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0faf4" },
  card: { background: "#fff", borderRadius: 16, padding: "40px 36px", width: "100%", maxWidth: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 24, color: "#1a1a1a", textAlign: "center" },
  form: { display: "flex", flexDirection: "column", gap: 8 },
  label: { fontSize: 13, fontWeight: 600, color: "#444", marginTop: 8 },
  input: { padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, outline: "none" },
  error: { color: "#e53e3e", fontSize: 13, margin: "4px 0" },
  btn: { marginTop: 16, padding: "12px", borderRadius: 8, background: "hsl(152,73%,41%)", color: "#fff", fontWeight: 600, fontSize: 15, border: "none", cursor: "pointer" },
};
