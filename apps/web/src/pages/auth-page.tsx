import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { z } from "zod";
import { BrandLockup } from "../components/brand-mark";
import {
  Button,
  FieldLabel,
  IconButton,
  SegmentedControl,
  TextInput
} from "@inkloom/ui";
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
  const [showPassword, setShowPassword] = useState(false);
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
      <section className="relative w-full max-w-[27rem]">
        <div className="mb-7 flex justify-center">
          <BrandLockup />
        </div>
        <div className="rounded-panel border border-line bg-paper p-5 shadow-xs sm:p-7">
          <SegmentedControl
            value={mode}
            ariaLabel="账号入口"
            className="bg-[#efefed]"
            itemClassName="min-h-10 rounded-md text-sm data-[state=on]:shadow-none"
            onValueChange={(nextMode) =>
              navigate(nextMode === "login" ? "/login" : "/register")
            }
            options={[
              { value: "login", label: "登录" },
              { value: "register", label: "创建账号" }
            ]}
          />

          <div className="mt-7 text-center">
            <h1 className="text-balance font-display text-[1.8rem] font-semibold tracking-[-0.025em] text-ink-950">
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
            <div className="grid gap-2 text-sm font-semibold text-ink-700">
              <label htmlFor="auth-password">密码</label>
              <span className="grid grid-cols-[minmax(0,1fr)_2.75rem] gap-2">
                <TextInput
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  className="min-w-0"
                  placeholder="至少 8 个字符"
                  {...form.register("password")}
                />
                <IconButton
                  type="button"
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  aria-pressed={showPassword}
                  variant="secondary"
                  className="size-11 min-h-11 rounded-xl text-ink-500"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </IconButton>
              </span>
              {mode === "register" && (
                <span className="text-xs font-normal leading-5 text-ink-500">
                  至少 8 个字符，建议混合使用字母、数字和符号。
                </span>
              )}
              <FieldError message={form.formState.errors.password?.message} />
            </div>
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

          <div className="mt-5 flex items-center justify-center gap-4 text-[0.75rem] font-medium text-ink-500">
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
