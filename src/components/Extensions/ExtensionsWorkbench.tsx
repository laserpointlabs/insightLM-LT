import { useEffect, useMemo, useState } from "react";
import { extensionRegistry } from "../../services/extensionRegistry";
import type { ExtensionManifest } from "../../types";
import { testIds } from "../../testing/testIds";
import { notifyError } from "../../utils/notify";

export function ExtensionsWorkbench(props: { onOpenDetails: (extensionId: string) => void }) {
  const [extensions, setExtensions] = useState<ExtensionManifest[]>(() => extensionRegistry.getAllExtensions());
  const [enabledById, setEnabledById] = useState<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {};
    extensionRegistry.getAllExtensions().forEach((e) => (out[e.id] = extensionRegistry.isExtensionEnabled(e.id)));
    return out;
  });

  useEffect(() => {
    const update = () => {
      const all = extensionRegistry.getAllExtensions();
      setExtensions(all);
      const out: Record<string, boolean> = {};
      all.forEach((e) => (out[e.id] = extensionRegistry.isExtensionEnabled(e.id)));
      setEnabledById(out);
    };
    const unsub = extensionRegistry.subscribe(update);
    update();
    return () => unsub();
  }, []);

  // Fail-soft: surface best-effort server lifecycle failures as non-blocking toasts.
  useEffect(() => {
    const onErr = (e: Event) => {
      const ce = e as CustomEvent<any>;
      const msg = String(ce?.detail?.message || "Failed to update extension state");
      notifyError(msg, "Extensions");
    };
    window.addEventListener("extensions:syncError", onErr as any);
    return () => window.removeEventListener("extensions:syncError", onErr as any);
  }, []);

  const sorted = useMemo(() => {
    const xs = Array.isArray(extensions) ? [...extensions] : [];
    xs.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")) || String(a.id || "").localeCompare(String(b.id || "")));
    return xs;
  }, [extensions]);

  const toggle = (id: string) => {
    const currentlyEnabled = extensionRegistry.isExtensionEnabled(id);
    try {
      if (currentlyEnabled) extensionRegistry.disableExtension(id);
      else extensionRegistry.enableExtension(id);
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Failed to toggle extension", "Extensions");
    }
    setEnabledById((prev) => ({ ...prev, [id]: !currentlyEnabled }));
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid={testIds.extensions.container}>
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">Extensions</div>
        <div className="mt-0.5 text-[11px] text-gray-500">Enable/disable extensions and open details in a tab.</div>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-gray-500" data-testid={testIds.extensions.emptyState}>
          No extensions registered
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {sorted.map((ext) => {
            const isEnabled = enabledById[ext.id] ?? extensionRegistry.isExtensionEnabled(ext.id);
            const tid = testIds.extensions.item(ext.id);
            const toggleTid = testIds.extensions.toggle(ext.id);
            return (
              <div
                key={ext.id}
                className="flex items-start gap-3 border-b border-gray-100 px-3 py-3 hover:bg-gray-50"
                data-testid={tid}
              >
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    checked={!!isEnabled}
                    onChange={() => toggle(ext.id)}
                    data-testid={toggleTid}
                    aria-label={`Enable ${ext.name}`}
                  />
                </div>

                <button
                  type="button"
                  className="flex min-w-0 flex-1 flex-col text-left"
                  onClick={() => props.onOpenDetails(ext.id)}
                  title="Open extension details"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-gray-900">{ext.name}</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                      isEnabled ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"
                    }`}>
                      {isEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-gray-600">{ext.description}</div>
                  <div className="mt-1 text-[11px] text-gray-500">
                    <span className="font-mono">{ext.id}</span> · v{ext.version}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
