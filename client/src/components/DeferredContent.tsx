import { useEffect, useRef, useState, type ReactNode } from "react";

type DeferredContentProps = {
  children: ReactNode;
  label: string;
  minHeight?: number;
  rootMargin?: string;
};

export function DeferredContent({
  children,
  label,
  minHeight = 180,
  rootMargin = "480px 0px"
}: DeferredContentProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(() => (
    import.meta.env.MODE === "test" || typeof IntersectionObserver === "undefined"
  ));

  useEffect(() => {
    if (ready || !ref.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setReady(true);
      observer.disconnect();
    }, { rootMargin });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ready, rootMargin]);

  return (
    <div ref={ref} className="deferred-content" style={{ minHeight: ready ? undefined : minHeight }}>
      {ready ? children : (
        <div className="deferred-content__placeholder" role="status" aria-label={`${label} 준비 중`}>
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  );
}
