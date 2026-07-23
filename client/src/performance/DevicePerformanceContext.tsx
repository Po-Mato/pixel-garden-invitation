import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { networkConnection, type NetworkConnectionLike } from "./networkQuality";

export type DevicePerformanceMode = "standard" | "lite";
export type DevicePerformanceReason = "standard" | "memory" | "processor" | "network";

export type DevicePerformanceStatus = {
  mode: DevicePerformanceMode;
  reason: DevicePerformanceReason;
};

export type DeviceNavigatorLike = {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  connection?: NetworkConnectionLike;
  mozConnection?: NetworkConnectionLike;
  webkitConnection?: NetworkConnectionLike;
};

export function resolveDevicePerformanceStatus(source: DeviceNavigatorLike = navigator): DevicePerformanceStatus {
  if (typeof source.deviceMemory === "number" && source.deviceMemory > 0 && source.deviceMemory <= 4) {
    return { mode: "lite", reason: "memory" };
  }
  if (typeof source.hardwareConcurrency === "number" && source.hardwareConcurrency > 0 && source.hardwareConcurrency <= 4) {
    return { mode: "lite", reason: "processor" };
  }
  const connection = networkConnection(source);
  if (connection?.saveData || connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g") {
    return { mode: "lite", reason: "network" };
  }
  return { mode: "standard", reason: "standard" };
}

const DevicePerformanceContext = createContext<DevicePerformanceStatus>({ mode: "standard", reason: "standard" });

export function DevicePerformanceProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState(() => resolveDevicePerformanceStatus());

  useEffect(() => {
    const update = () => setStatus(resolveDevicePerformanceStatus());
    const connection = networkConnection();
    connection?.addEventListener?.("change", update);
    update();
    return () => connection?.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.performanceMode = status.mode;
    document.documentElement.dataset.performanceReason = status.reason;
    return () => {
      delete document.documentElement.dataset.performanceMode;
      delete document.documentElement.dataset.performanceReason;
    };
  }, [status]);

  const value = useMemo(() => status, [status]);
  return <DevicePerformanceContext.Provider value={value}>{children}</DevicePerformanceContext.Provider>;
}

export function useDevicePerformance(): DevicePerformanceStatus {
  return useContext(DevicePerformanceContext);
}
