import {
  BrowserLocalAdapter,
  type BrowserKeyValueStorage
} from "./browser-local";
import { defineWorkspaceAdapterContract } from "./workspace-adapter-contract";

class ContractStorage implements BrowserKeyValueStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

defineWorkspaceAdapterContract("BrowserLocalAdapter", () => ({
  adapter: new BrowserLocalAdapter({
    storage: new ContractStorage(),
    createId: () => "contract-document"
  }),
  workspaceId: "contract-workspace"
}));
