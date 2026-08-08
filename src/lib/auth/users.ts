import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { uid } from "../storage";

export type StoredUser = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: number;
  data: {
    history: unknown[];
    templates: unknown[];
    board: unknown[];
  };
};

type UserStore = { users: StoredUser[] };

function storePath(): string {
  return path.join(process.cwd(), ".data", "users.json");
}

const memoryStore: UserStore = { users: [] };
let loaded = false;

function load(): UserStore {
  try {
    const raw = readFileSync(storePath(), "utf8");
    return JSON.parse(raw) as UserStore;
  } catch {
    return { users: [] };
  }
}

function persist(store: UserStore): boolean {
  try {
    mkdirSync(path.dirname(storePath()), { recursive: true });
    writeFileSync(storePath(), JSON.stringify(store, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}

function getStore(): UserStore {
  if (!loaded) {
    const disk = load();
    memoryStore.users = disk.users;
    loaded = true;
  }
  return memoryStore;
}

function save(): void {
  if (!persist(getStore())) {
    // Keep the in-memory copy so the session still works within this process.
    console.warn("[auth] Could not persist users to disk — falling back to memory.");
  }
}

export function createUser(email: string, passwordHash: string): StoredUser {
  const user: StoredUser = {
    id: uid(),
    email,
    passwordHash,
    createdAt: Date.now(),
    data: { history: [], templates: [], board: [] },
  };
  getStore().users.push(user);
  save();
  return user;
}

export function findUserByEmail(email: string): StoredUser | null {
  const normalized = email.trim().toLowerCase();
  return getStore().users.find((u) => u.email === normalized) ?? null;
}

export function findUserById(id: string): StoredUser | null {
  return getStore().users.find((u) => u.id === id) ?? null;
}

export function updateUserData(
  id: string,
  data: StoredUser["data"]
): StoredUser | null {
  const user = findUserById(id);
  if (!user) return null;
  user.data = data;
  save();
  return user;
}

export function deleteUser(id: string): boolean {
  const store = getStore();
  const before = store.users.length;
  store.users = store.users.filter((u) => u.id !== id);
  if (store.users.length === before) return false;
  save();
  return true;
}
