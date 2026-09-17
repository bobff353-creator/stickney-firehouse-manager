"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PortalPage } from "./portal-navigation";

type TaskReturn = { owner: symbol; page: PortalPage; label: string; record?: string; task?: string; disabled?: boolean; onBack: () => void };
type Navigation = { current: TaskReturn | null; register: (task: TaskReturn) => () => void };
const TaskNavigation = createContext<Navigation | null>(null);

/** A mounted task replaces, never adds to, the shell's return action. */
export function WorkspaceTaskNavigation({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<TaskReturn | null>(null);
  const register = useCallback((task: TaskReturn) => {
    setCurrent(task);
    return () => setCurrent(value => value?.owner === task.owner ? null : value);
  }, []);
  const value = useMemo(() => ({ current, register }), [current, register]);
  return <TaskNavigation.Provider value={value}>{children}</TaskNavigation.Provider>;
}

export function useWorkspaceTaskReturn(page: PortalPage, label: string | null, onBack: () => void, options: { record?: string; task?: string; disabled?: boolean } = {}) {
  const navigation = useContext(TaskNavigation);
  const register = navigation?.register;
  const [owner] = useState(() => Symbol("workspace-task"));
  const handler = useRef(onBack);
  useEffect(() => { handler.current = onBack; }, [onBack]);
  const { record, task, disabled } = options;
  useEffect(() => {
    if (!register || !label) return;
    return register({ owner, page, label, record, task, disabled, onBack: () => handler.current() });
  }, [register, owner, page, label, record, task, disabled]);
  return Boolean(navigation);
}

export function useWorkspaceTaskNavigation(page: PortalPage) {
  const navigation = useContext(TaskNavigation);
  return navigation?.current?.page === page ? navigation.current : null;
}
