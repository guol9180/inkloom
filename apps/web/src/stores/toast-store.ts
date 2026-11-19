import { create } from "zustand";

type ToastState = {
  message: string;
  timer?: number;
  show: (message: string) => void;
  clear: () => void;
};

export const useToastStore = create<ToastState>((set, get) => ({
  message: "",
  show(message) {
    const activeTimer = get().timer;
    if (activeTimer !== undefined) window.clearTimeout(activeTimer);
    const timer = window.setTimeout(() => set({ message: "", timer: undefined }), 2600);
    set({ message, timer });
  },
  clear() {
    const activeTimer = get().timer;
    if (activeTimer !== undefined) window.clearTimeout(activeTimer);
    set({ message: "", timer: undefined });
  }
}));
