import { cn } from "./lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "skeleton-shimmer block rounded-lg bg-[linear-gradient(90deg,#efefed_25%,#fafafa_50%,#efefed_75%)] bg-[length:200%_100%]",
        className
      )}
      aria-hidden="true"
    />
  );
}

export function WorkspaceSkeleton() {
  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-canvas">
      <aside className="hidden w-[17rem] shrink-0 border-r border-line bg-canvas p-3 lg:block">
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="mt-5 h-10 w-full rounded-xl" />
        <div className="mt-6 grid gap-2">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton className="h-10 w-full rounded-xl" key={String(index)} />
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center border-b border-line bg-paper px-4">
          <Skeleton className="h-9 w-36 rounded-xl" />
          <Skeleton className="ml-auto size-9 rounded-xl" />
        </div>
        <div className="grid flex-1 place-items-center p-6">
          <div className="w-full max-w-3xl">
            <Skeleton className="mx-auto h-8 w-2/5 rounded-xl" />
            <Skeleton className="mx-auto mt-5 h-4 w-3/5" />
            <div className="mt-12 grid gap-3">
              {Array.from({ length: 9 }, (_, index) => (
                <Skeleton
                  className={cn(
                    "h-4 rounded-md",
                    index % 3 === 0
                      ? "w-11/12"
                      : index % 3 === 1
                        ? "w-full"
                        : "w-4/5"
                  )}
                  key={String(index)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
