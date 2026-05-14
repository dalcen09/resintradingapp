import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface Props {
  onBack: () => void;
}

export function RegisterPage({ onBack }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("パスワードが一致しません");
      return;
    }
    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <div style={styles.bg}>
        <div style={styles.card}>
          <h1 style={styles.title}>登録完了</h1>
          <p style={{ textAlign: "center", color: "#444", fontSize: 14, lineHeight: 1.6 }}>
            確認メールを送信しました。<br />
            メール内のリンクをクリックして登録を完了してください。
          </p>
          <button onClick={onBack} style={{ ...styles.btn, marginTop: 24 }}>
            ログインに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.bg}>
      <div style={styles.card}>
        <h1 style={styles.title}>新規登録</h1>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>メールアドレス</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={styles.input}
            placeholder="example@email.com"
          />
          <label style={styles.label}>パスワード</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={styles.input}
            placeholder="6文字以上"
          />
          <label style={styles.label}>パスワード（確認）</label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            style={styles.input}
            placeholder="••••••••"
          />
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? "処理中..." : "登録する"}
          </button>
        </form>
        <div style={styles.links}>
          <button onClick={onBack} style={styles.link}>ログインに戻る</button>
        </div>
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
  btn: { marginTop: 16, padding: "12px", borderRadius: 8, background: "hsl(152,73%,41%)", color: "#fff", fontWeight: 600, fontSize: 15, border: "none", cursor: "pointer", width: "100%" },
  links: { display: "flex", justifyContent: "center", gap: 12, marginTop: 20 },
  link: { background: "none", border: "none", color: "hsl(152,73%,35%)", fontSize: 13, cursor: "pointer", textDecoration: "underline" },
};
