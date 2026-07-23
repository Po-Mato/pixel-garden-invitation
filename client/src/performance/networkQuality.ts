import { useEffect, useState } from "react";

export type NetworkMode = "balanced" | "economy";

export type NetworkConnectionLike = {
  effectiveType?: string;
  saveData?: boolean;
  downlink?: number;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
};

export type NetworkNavigatorLike = {
  onLine?: boolean;
  connection?: NetworkConnectionLike;
  mozConnection?: NetworkConnectionLike;
  webkitConnection?: NetworkConnectionLike;
};

const constrainedTypes = new Set(["slow-2g", "2g", "3g"]);

export function networkConnection(
  source: NetworkNavigatorLike = navigator as NetworkNavigatorLike
): NetworkConnectionLike | undefined {
  return source.connection ?? source.mozConnection ?? source.webkitConnection;
}

export function resolveNetworkMode({
  dataSaver = false,
  online = true,
  connection
}: {
  dataSaver?: boolean;
  online?: boolean;
  connection?: NetworkConnectionLike;
} = {}): NetworkMode {
  if (!online || dataSaver || connection?.saveData) return "economy";
  if (connection?.effectiveType && constrainedTypes.has(connection.effectiveType)) return "economy";
  if (typeof connection?.downlink === "number" && connection.downlink > 0 && connection.downlink <= 1.5) {
    return "economy";
  }
  return "balanced";
}

export function currentNetworkMode(
  dataSaver = typeof document !== "undefined" && document.documentElement.dataset.dataSaver === "true",
  source: NetworkNavigatorLike = navigator as NetworkNavigatorLike
): NetworkMode {
  return resolveNetworkMode({
    dataSaver,
    online: source.onLine !== false,
    connection: networkConnection(source)
  });
}

export function useNetworkMode(dataSaver: boolean): NetworkMode {
  const resolve = () => currentNetworkMode(dataSaver);
  const [mode, setMode] = useState<NetworkMode>(resolve);

  useEffect(() => {
    const update = () => setMode(resolve());
    const connection = networkConnection();
    connection?.addEventListener?.("change", update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();
    return () => {
      connection?.removeEventListener?.("change", update);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [dataSaver]);

  return mode;
}
