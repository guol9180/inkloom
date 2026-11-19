import { useState, type FormEvent } from "react";
import { ArrowRight, Check, FileText, Network, ShieldCheck } from "lucide-react";
import type { CloudUser } from "@inkloom/storage";
import { BrandMark } from "./BrandMark";

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
          : "无法连接 InkLoom 服务，请稍后重试。"
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
      <section className="auth-spine" aria-label="InkLoom 产品说明">
        <div className="auth-brand">
          <BrandMark className="auth-brand-mark" />
          <div>
            <strong>InkLoom</strong>
            <span>Markdown workspace</span>
          </div>
        </div>

        <div className="auth-statement">
          <p className="auth-chapter">安静、清晰、属于你的写作空间</p>
          <h1>
            让每个想法，
            <br />
            都有生长的余地。
          </h1>
          <p>
            Markdown 保留原文，图表保留源码。文字、画布与版本，都安放在同一个清爽的云端工作区。
          </p>
        </div>

        <ul className="auth-capabilities">
          <li>
            <FileText size={16} />
            <span>正文始终可以随时导出</span>
            <Check size={14} />
          </li>
          <li>
            <Network size={16} />
            <span>图表与画布保持可编辑</span>
            <Check size={14} />
          </li>
          <li>
            <ShieldCheck size={16} />
            <span>版本冲突会明确保留两份</span>
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
            <h2>{mode === "login" ? "欢迎回来" : "开始新的知识空间"}</h2>
            <p>
              {mode === "login"
                ? "登录后，继续上一次未完的想法。"
                : "创建账号后，会自动准备好第一篇云端文档。"}
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
            密码使用强哈希保存，会话通过安全的 HttpOnly Cookie 传递。
          </p>
        </div>
      </section>
    </main>
  );
}
