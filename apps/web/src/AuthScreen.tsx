import { useState, type FormEvent } from "react";
import { ArrowRight, Check, FileText, Network, ShieldCheck } from "lucide-react";
import type { CloudUser } from "@inkloom/storage";

type AuthMode = "login" | "register";

export function AuthScreen({
  onLogin,
  onRegister
}: {
  onLogin: (email: string, password: string) => Promise<CloudUser>;
  onRegister: (
    displayName: string,
    email: string,
    password: string
  ) => Promise<CloudUser>;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "register") {
        await onRegister(displayName, email, password);
      } else {
        await onLogin(email, password);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "无法连接墨织服务，请稍后重试。"
      );
    } finally {
      setBusy(false);
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
  }

  return (
    <main className="auth-shell">
      <section className="auth-spine" aria-label="墨织产品说明">
        <div className="auth-brand">
          <span className="brand-mark auth-brand-mark" aria-hidden="true">
            <span>墨</span>
          </span>
          <div>
            <strong>墨织</strong>
            <span>INKLOOM</span>
          </div>
        </div>

        <div className="auth-statement">
          <p className="auth-chapter">Markdown 工作台</p>
          <h1>
            写下的文字，
            <br />
            应该属于你。
          </h1>
          <p>
            正文保持为 Markdown，图表保留可编辑源码。登录后，文档会保存到你的云端工作区。
          </p>
        </div>

        <ul className="auth-capabilities">
          <li>
            <FileText size={16} />
            <span>Markdown 原文随时可导出</span>
            <Check size={14} />
          </li>
          <li>
            <Network size={16} />
            <span>Mermaid 与 Excalidraw 独立保留</span>
            <Check size={14} />
          </li>
          <li>
            <ShieldCheck size={16} />
            <span>revision 冲突保护，不静默覆盖</span>
            <Check size={14} />
          </li>
        </ul>
      </section>

      <section className="auth-paper">
        <div className="auth-card">
          <div className="auth-tabs" role="tablist" aria-label="账号入口">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={mode === "login" ? "is-active" : ""}
              onClick={() => switchMode("login")}
            >
              登录
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              className={mode === "register" ? "is-active" : ""}
              onClick={() => switchMode("register")}
            >
              创建账号
            </button>
          </div>

          <header className="auth-card-head">
            <h2>{mode === "login" ? "回到你的工作区" : "建立第一本知识册"}</h2>
            <p>
              {mode === "login"
                ? "使用邮箱和密码继续写作。"
                : "创建后会自动获得一个云端工作区。"}
            </p>
          </header>

          <form className="auth-form" onSubmit={submit}>
            {mode === "register" && (
              <label>
                <span>称呼</span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="name"
                  maxLength={40}
                  placeholder="怎么称呼你"
                />
              </label>
            )}
            <label>
              <span>邮箱</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
                maxLength={254}
                placeholder="name@example.com"
                required
                autoFocus
              />
            </label>
            <label>
              <span>密码</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={8}
                maxLength={128}
                placeholder="至少 8 个字符"
                required
              />
            </label>

            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}

            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? "正在连接…" : mode === "login" ? "进入工作区" : "创建并进入"}
              {!busy && <ArrowRight size={17} />}
            </button>
          </form>

          <p className="auth-fineprint">
            密码只以 scrypt 强哈希保存；会话使用 HttpOnly Cookie。
          </p>
        </div>
      </section>
    </main>
  );
}
