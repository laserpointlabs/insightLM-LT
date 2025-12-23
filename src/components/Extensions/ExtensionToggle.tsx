import { useEffect, useState, useRef } from "react";
import { extensionRegistry } from "../../services/extensionRegistry";
import { ExtensionManifest } from "../../types";

export function ExtensionToggle() {
  const [isOpen, setIsOpen] = useState(false);
  const [extensions, setExtensions] = useState<ExtensionManifest[]>(extensionRegistry.getAllExtensions());
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => {
    const current: Record<string, boolean> = {};
    extensionRegistry.getAllExtensions().forEach((ext) => {
      current[ext.id] = extensionRegistry.isExtensionEnabled(ext.id);
    });
    return current;
  });
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const update = () => {
      setExtensions(extensionRegistry.getAllExtensions());
      const state: Record<string, boolean> = {};
      extensionRegistry.getAllExtensions().forEach((ext) => {
        state[ext.id] = extensionRegistry.isExtensionEnabled(ext.id);
      });
      setEnabled(state);
    };

    const unsubscribe = extensionRegistry.subscribe(update);
    update();

    const onClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);

    return () => {
      unsubscribe();
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

  const toggleExtension = (id: string) => {
    const currentlyEnabled = extensionRegistry.isExtensionEnabled(id);
    if (currentlyEnabled) {
      extensionRegistry.disableExtension(id);
    } else {
      extensionRegistry.enableExtension(id);
    }
    setEnabled((prev) => ({ ...prev, [id]: !currentlyEnabled }));
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((open) => !open)}
        className="rounded px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
        title="Toggle extensions"
      >
        Extensions
      </button>
      {isOpen && (
        <div className="absolute right-0 z-20 mt-1 w-52 rounded border border-gray-200 bg-white shadow-lg">
          <div className="px-3 py-2 text-xs font-semibold text-gray-600 border-b border-gray-100">
            Manage Extensions
          </div>
          {extensions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-500">No extensions registered</div>
          ) : (
            extensions.map((ext) => (
              <label
                key={ext.id}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={enabled[ext.id] ?? false}
                  onChange={() => toggleExtension(ext.id)}
                />
                <div className="flex flex-col">
                  <span className="text-gray-800">{ext.name}</span>
                  <span className="text-[11px] text-gray-500">{ext.description}</span>
                </div>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

