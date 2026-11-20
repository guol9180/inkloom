import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
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
    <main className="app-auth-shell relative grid min-h-dvh place-items-center overflow-hidden bg-canvas px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgb(255_255_255/.95),transparent_34rem)]" />
      <section className="relative w-full max-w-[27rem]">
        <div className="mb-7 flex justify-center">
          <BrandLockup />
        </div>
        <div className="rounded-dialog border border-line-soft bg-white/92 p-5 shadow-panel backdrop-blur-xl sm:p-7">
          <div
            className="grid grid-cols-2 rounded-xl bg-surface-subtle p-1"
            role="tablist"
            aria-label="账号入口"
          >
            {(["login", "register"] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={mode === item}
                className={`min-h-10 rounded-[0.65rem] text-sm font-semibold transition ${
                  mode === item
                    ? "bg-white text-ink-950 shadow-sm"
                    : "text-ink-400 hover:text-ink-700"
                }`}
                onClick={() =>
                  navigate(item === "login" ? "/login" : "/register")
                }
              >
                {item === "login" ? "登录" : "创建账号"}
              </button>
            ))}
          </div>

          <div className="mt-7 text-center">
            <h1 className="text-balance font-display text-[1.85rem] font-semibold tracking-[-0.04em] text-ink-950">
              {mode === "login" ? "继续写下去" : "建立你的空间"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-ink-500">
              {mode === "login"
                ? "回到上一次停下的位置。"
                : "一个安静、可导出的 Markdown 工作区。"}
            </p>
          </div>

          <form
            className="mt-6 grid gap-4"
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
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                placeholder="至少 8 个字符"
                {...form.register("password")}
              />
              <FieldError message={form.formState.errors.password?.message} />
            </FieldLabel>
            {mutation.error && (
              <p
                className="rounded-xl border border-danger-200 bg-danger-50 px-3.5 py-3 text-sm leading-5 text-danger-700"
                role="alert"
              >
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

          <div className="mt-5 flex items-center justify-center gap-4 text-[0.68rem] font-medium text-ink-400">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={13} /> 安全会话
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check size={13} /> Markdown 可导出
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <span className="text-xs font-medium text-danger-700">{message}</span>
  ) : null;
}

function safeNextPath(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}
