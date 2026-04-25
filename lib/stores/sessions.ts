"use client";

import { create } from "zustand";
import { idbDelete, idbGetAll, idbPut, STORE_SESSIONS } from "@/lib/db/idb";
import { useJobsStore } from "@/lib/stores/jobs";
import type { ReferenceImage, Storyboard } from "@/lib/types";

export interface SessionMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  storyboard?: Storyboard;
}

export interface ChatSessionRecord {
  id: string;
  title: string;
  messages: SessionMessage[];
  refImages: ReferenceImage[];
  createdAt: number;
  updatedAt: number;
}

interface SessionsState {
  sessions: ChatSessionRecord[];
  activeId: string | null;
  loaded: boolean;
  load: () => Promise<void>;
  newSession: () => string;
  switchTo: (id: string) => void;
  remove: (id: string) => Promise<void>;
  /** Persist the active session with the given snapshot. */
  saveActive: (snapshot: Omit<ChatSessionRecord, "id" | "createdAt" | "updatedAt">) => Promise<void>;
}

const ACTIVE_KEY = "s2v_active_session_v1";

function deriveTitle(messages: SessionMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "新会话";
  const t = first.content.trim().split(/\s+/).slice(0, 6).join(" ");
  return t.length > 40 ? `${t.slice(0, 40)}…` : t || "新会话";
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  activeId: null,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    try {
      const list = await idbGetAll<ChatSessionRecord>(STORE_SESSIONS);
      list.sort((a, b) => b.createdAt - a.createdAt);
      const stored =
        typeof window !== "undefined" ? localStorage.getItem(ACTIVE_KEY) : null;
      const activeId =
        list.find((s) => s.id === stored)?.id ?? list[0]?.id ?? null;
      set({ sessions: list, activeId, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  newSession: () => {
    const id = crypto.randomUUID();
    const rec: ChatSessionRecord = {
      id,
      title: "新会话",
      messages: [],
      refImages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((s) => ({ sessions: [rec, ...s.sessions], activeId: id }));
    if (typeof window !== "undefined") localStorage.setItem(ACTIVE_KEY, id);
    void idbPut(STORE_SESSIONS, rec);
    return id;
  },
  switchTo: (id) => {
    set({ activeId: id });
    if (typeof window !== "undefined") localStorage.setItem(ACTIVE_KEY, id);
  },
  remove: async (id) => {
    await Promise.all([
      idbDelete(STORE_SESSIONS, id),
      useJobsStore.getState().clearSessionCache(id),
    ]);
    set((s) => {
      const sessions = s.sessions.filter((x) => x.id !== id);
      const activeId = s.activeId === id ? sessions[0]?.id ?? null : s.activeId;
      if (typeof window !== "undefined") {
        if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
        else localStorage.removeItem(ACTIVE_KEY);
      }
      return { sessions, activeId };
    });
  },
  saveActive: async (snapshot) => {
    const { activeId, sessions } = get();
    if (!activeId) return;
    const existing = sessions.find((s) => s.id === activeId);
    const merged: ChatSessionRecord = {
      id: activeId,
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      title: snapshot.title || deriveTitle(snapshot.messages),
      messages: snapshot.messages,
      refImages: snapshot.refImages,
    };
    await idbPut(STORE_SESSIONS, merged);
    set((s) => ({
      sessions: s.sessions.map((x) => (x.id === activeId ? merged : x)),
    }));
  },
}));
