import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface Props {
  onBack: () => void;
}

export function ForgotPasswordPage({ onBack }: Props) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
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
          <h1 style={styles.title}>メール送信完了</h1>
          <p style={{ textAlign: "center", color: "#444", fontSize: 14, lineHeight: 1.6 }}>
            パスワードリセット用のメールを送信しました。<br />
            メール内のリンクからパスワードを再設定してください。
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
        <h1 style={styles.title}>パスワードをお忘れの方</h1>
        <p style={{ fontSize: 13, color: "#666", marginBottom: 16, textAlign: "center" }}>
          登録済みのメールアドレスを入力してください。<br />パスワードリセット用のリンクをお送りします。
        </p>
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
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? "送信中..." : "リセットメールを送信"}
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
  title: { fontSize: 22, fontWeight: 700, marginBottom: 16, color: "#1a1a1a", textAlign: "center" },
  form: { display: "flex", flexDirection: "column", gap: 8 },
  label: { fontSize: 13, fontWeight: 600, color: "#444", marginTop: 8 },
  input: { padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, outline: "none" },
  error: { color: "#e53e3e", fontSize: 13, margin: "4px 0" },
  btn: { marginTop: 16, padding: "12px", borderRadius: 8, background: "hsl(152,73%,41%)", color: "#fff", fontWeight: 600, fontSize: 15, border: "none", cursor: "pointer", width: "100%" },
  links: { display: "flex", justifyContent: "center", gap: 12, marginTop: 20 },
  link: { background: "none", border: "none", color: "hsl(152,73%,35%)", fontSize: 13, cursor: "pointer", textDecoration: "underline" },
};
