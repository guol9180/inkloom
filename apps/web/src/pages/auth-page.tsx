import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  Cloud,
  FileText,
  Network,
  ShieldCheck
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { z } from "zod";
import { BrandLockup } from "../components/brand-mark";
import { Button } from "../components/ui/button";
import { FieldLabel, TextInput } from "../components/ui/field";
import { cloudClient } from "../cloud-workspace";
import { sessionQuery } from "../queries";

const authSchema = z.object({
  displayName: z.string().max(40).optional(),
  email: z.email("请输入有效邮箱。"),
  password: z.string().min(8, "密码至少需要 8 个字符。").max(128)
});

type AuthValues = z.infer<typeof authSchema>;

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const queryClient = useQueryClient();
  const session = queryClient.getQueryData(sessionQuery.queryKey);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const form = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { displayName: "", email: "", password: "" }
  });
  const mutation = useMutation({
    mutationFn: (values: AuthValues) =>
      mode === "register"
        ? cloudClient.register({
            displayName: values.displayName?.trim() || undefined,
            email: values.email,
            password: values.password
          })
        : cloudClient.login({ email: values.email, password: values.password }),
    onSuccess(user) {
      queryClient.setQueryData(sessionQuery.queryKey, user);
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      navigate(next, { replace: true });
    }
  });

  if (session) return <Navigate to={next} replace />;

  return (
    <main className="auth-shell grid min-h-dvh bg-canvas lg:grid-cols-[minmax(0,1.12fr)_minmax(27rem,.88fr)]">
      <section className="relative isolate hidden overflow-hidden bg-brand-900 px-8 py-9 text-white lg:flex lg:flex-col lg:justify-between xl:px-14 xl:py-12">
        <div className="auth-orbit auth-orbit-one" />
        <div className="auth-orbit auth-orbit-two" />
        <div className="relative z-10 flex items-center justify-between">
          <BrandLockup inverse />
          <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-medium text-brand-100">
            Cloud workspace
          </span>
        </div>

        <div className="relative z-10 max-w-[43rem] py-16">
          <p className="mb-5 flex items-center gap-2 text-sm font-medium text-brand-200">
            <span className="size-1.5 rounded-full bg-sun-400" />
            让想法保持清晰，也保持可编辑
          </p>
          <h1 className="font-display text-[clamp(3.25rem,5.3vw,6.8rem)] leading-[0.94] font-medium tracking-[-0.065em] text-balance">
            文字在纸上，
            <br />
            结构在手中。
          </h1>
          <p className="mt-7 max-w-[36rem] text-[1.02rem] leading-7 text-brand-100/78">
            InkLoom 把 Markdown、图表源码和版本历史放进一个安静的工作台。没有格式锁定，也没有被藏起来的原文。
          </p>
        </div>

        <div className="relative z-10 grid max-w-[42rem] grid-cols-3 gap-3">
          {([
            { Icon: FileText, title: "Markdown", caption: "原文随时导出" },
            { Icon: Network, title: "图表", caption: "源码仍可编辑" },
            { Icon: ShieldCheck, title: "版本", caption: "冲突不覆盖" }
          ] satisfies Array<{ Icon: LucideIcon; title: string; caption: string }>).map(({ Icon, title, caption }) => {
            const ItemIcon = Icon;
            return (
              <div
                className="rounded-2xl border border-white/11 bg-white/7 p-3.5 backdrop-blur-sm"
                key={String(title)}
              >
                <ItemIcon size={17} className="text-brand-200" />
                <strong className="mt-3 block text-sm font-semibold">{title}</strong>
                <span className="mt-1 block text-xs text-brand-100/62">{caption}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="relative flex items-center justify-center px-4 py-8 sm:px-8 lg:px-10">
        <div className="w-full max-w-[29rem]">
          <div className="mb-10 flex items-center justify-between lg:hidden">
            <BrandLockup />
          </div>
          <div className="rounded-[1.75rem] border border-white/85 bg-paper/92 p-5 shadow-[0_26px_80px_rgb(32_70_54_/_0.11)] backdrop-blur-sm sm:p-8">
            <div className="mb-7 flex rounded-xl bg-canvas p-1" role="tablist" aria-label="账号入口">
              {(["login", "register"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={mode === item}
                  className={`min-h-10 flex-1 rounded-[0.6rem] text-sm font-semibold transition ${
                    mode === item
                      ? "bg-white text-ink-950 shadow-sm"
                      : "text-ink-400 hover:text-ink-700"
                  }`}
                  onClick={() => navigate(item === "login" ? "/login" : "/register")}
                >
                  {item === "login" ? "登录" : "创建账号"}
                </button>
              ))}
            </div>

            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-brand-600 uppercase">
                <Cloud size={14} /> secure writing space
              </p>
              <h2 className="font-display text-3xl font-semibold tracking-[-0.035em] text-ink-950">
                {mode === "login" ? "继续写下去" : "建立你的工作区"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-500">
                {mode === "login"
                  ? "登录后回到上一次停下的位置。"
                  : "注册后会准备好第一个云端工作区。"}
              </p>
            </div>

            <form
              className="mt-7 grid gap-4"
              onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            >
              {mode === "register" && (
                <FieldLabel>
                  称呼
                  <TextInput
                    autoComplete="name"
                    maxLength={40}
                    placeholder="怎么称呼你"
                    {...form.register("displayName")}
                  />
                </FieldLabel>
              )}
              <FieldLabel>
                邮箱
                <TextInput
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  {...form.register("email")}
                />
                <FieldError message={form.formState.errors.email?.message} />
              </FieldLabel>
              <FieldLabel>
                密码
                <TextInput
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="至少 8 个字符"
                  {...form.register("password")}
                />
                <FieldError message={form.formState.errors.password?.message} />
              </FieldLabel>
              {mutation.error && (
                <p className="rounded-xl border border-danger-200 bg-danger-50 px-3.5 py-3 text-sm leading-5 text-danger-700" role="alert">
                  {mutation.error instanceof Error
                    ? mutation.error.message
                    : "无法连接 InkLoom 服务，请稍后重试。"}
                </p>
              )}
              <Button
                variant="primary"
                size="md"
                type="submit"
                disabled={mutation.isPending}
                className="mt-1 min-h-12"
              >
                {mutation.isPending
                  ? "正在连接…"
                  : mode === "login"
                    ? "进入工作区"
                    : "创建并进入"}
                {!mutation.isPending && <ArrowRight size={17} />}
              </Button>
            </form>

            <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-ink-400">
              <Check size={14} className="mt-0.5 shrink-0 text-brand-600" />
              密码采用强哈希保存；会话使用 HttpOnly、SameSite Cookie。
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <span className="text-xs font-medium text-danger-700">{message}</span> : null;
}

function safeNextPath(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}
