import { useEffect, useMemo, useState } from "react";
import { extensionRegistry } from "../../services/extensionRegistry";
import { testIds } from "../../testing/testIds";
import type { ExtensionManifest } from "../../types";

function Row(props: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-1">
      <div className="text-xs font-semibold text-gray-600">{props.label}</div>
      <div className="min-w-0 text-xs text-gray-800">{props.value}</div>
    </div>
  );
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-gray-200 bg-white">
      <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
        {props.title}
      </div>
      <div className="px-3 py-2">{props.children}</div>
    </div>
  );
}

export function ExtensionDetailsTab(props: { extensionId: string }) {
  const [manifest, setManifest] = useState<ExtensionManifest | null>(() => {
    const m = extensionRegistry.getExtension(props.extensionId);
    return m ? (m as any) : null;
  });
  const [enabled, setEnabled] = useState<boolean>(() => extensionRegistry.isExtensionEnabled(props.extensionId));

  useEffect(() => {
    const unsub = extensionRegistry.subscribe(() => {
      const m = extensionRegistry.getExtension(props.extensionId);
      setManifest(m ? (m as any) : null);
      setEnabled(extensionRegistry.isExtensionEnabled(props.extensionId));
    });
    return () => unsub();
  }, [props.extensionId]);

  const summary = useMemo(() => {
    const m = manifest;
    if (!m) return null;
    const contributes = m.contributes || {};
    const counts = {
      views: Array.isArray(contributes.views) ? contributes.views.length : 0,
      commands: Array.isArray(contributes.commands) ? contributes.commands.length : 0,
      fileHandlers: Array.isArray(contributes.fileHandlers) ? contributes.fileHandlers.length : 0,
      contextProviders: Array.isArray(contributes.contextProviders) ? contributes.contextProviders.length : 0,
      notebookProviders: Array.isArray(contributes.notebookProviders) ? contributes.notebookProviders.length : 0,
      workbookActions: Array.isArray(contributes.workbookActions) ? contributes.workbookActions.length : 0,
    };
    return counts;
  }, [manifest]);

  if (!manifest) {
    return (
      <div className="p-4" data-testid={testIds.extensions.details.container}>
        <div className="text-sm font-semibold text-gray-800">Extension not found</div>
        <div className="mt-1 text-xs text-gray-500">id: {props.extensionId}</div>
      </div>
    );
  }

  const m = manifest;
  const contributes = m.contributes || {};
  const activation = Array.isArray(m.activationEvents) ? m.activationEvents : [];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-4" data-testid={testIds.extensions.details.container}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold text-gray-900" data-testid={testIds.extensions.details.name}>
            {m.name}
          </div>
          <div className="mt-0.5 text-xs text-gray-600">
            <span className="font-mono" data-testid={testIds.extensions.details.id}>{m.id}</span> · v{m.version}
          </div>
          <div className="mt-2 text-sm text-gray-700">{m.description}</div>
        </div>
        <div className="shrink-0">
          <span
            className={`rounded px-2 py-1 text-[11px] font-semibold uppercase ${
              enabled ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"
            }`}
            data-testid={testIds.extensions.details.enabled}
          >
            {enabled ? "Enabled" : "Disabled"}
          </span>
        </div>
      </div>

      <Section title="Manifest">
        <Row label="Author" value={m.author ? String(m.author) : <span className="text-gray-400">—</span>} />
        <Row
          label="Activation events"
          value={
            activation.length ? (
              <ul className="list-disc pl-4">
                {activation.map((x) => (
                  <li key={x} className="font-mono text-[11px] text-gray-700">
                    {x}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-gray-400">—</span>
            )
          }
        />
        <Row
          label="Contribution counts"
          value={
            summary ? (
              <span className="text-gray-700">
                views {summary.views}, commands {summary.commands}, fileHandlers {summary.fileHandlers}, contextProviders{" "}
                {summary.contextProviders}, notebookProviders {summary.notebookProviders}, workbookActions {summary.workbookActions}
              </span>
            ) : (
              <span className="text-gray-400">—</span>
            )
          }
        />
      </Section>

      <Section title="MCP server (if any)">
        {m.mcpServer ? (
          <>
            <Row label="Name" value={<span className="font-mono text-[11px]">{m.mcpServer.name}</span>} />
            <Row label="Command" value={<span className="font-mono text-[11px]">{m.mcpServer.command}</span>} />
            <Row label="Args" value={<span className="font-mono text-[11px]">{(m.mcpServer.args || []).join(" ")}</span>} />
            <Row label="Server path" value={<span className="font-mono text-[11px]">{m.mcpServer.serverPath}</span>} />
          </>
        ) : (
          <div className="text-xs text-gray-500">No MCP server contribution</div>
        )}
      </Section>

      <Section title="Contributions (generic; decoupled)">
        <div className="space-y-3">
          <div>
            <div className="text-xs font-semibold text-gray-700">Views</div>
            {Array.isArray(contributes.views) && contributes.views.length ? (
              <ul className="mt-1 list-disc pl-4">
                {contributes.views.map((v: any) => (
                  <li key={String(v.id)} className="text-xs text-gray-700">
                    <span className="font-mono text-[11px]">{String(v.id)}</span> — {String(v.name || "")}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-1 text-xs text-gray-500">—</div>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-700">Commands</div>
            {Array.isArray(contributes.commands) && contributes.commands.length ? (
              <ul className="mt-1 list-disc pl-4">
                {contributes.commands.map((c: any) => (
                  <li key={String(c.id)} className="text-xs text-gray-700">
                    <span className="font-mono text-[11px]">{String(c.id)}</span> — {String(c.title || "")}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-1 text-xs text-gray-500">—</div>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-700">File handlers</div>
            {Array.isArray(contributes.fileHandlers) && contributes.fileHandlers.length ? (
              <ul className="mt-1 list-disc pl-4">
                {contributes.fileHandlers.map((h: any, idx: number) => (
                  <li key={`${idx}`} className="text-xs text-gray-700">
                    <span className="font-mono text-[11px]">{String((h.extensions || []).join(", "))}</span>
                    {typeof h.priority === "number" ? ` (priority ${h.priority})` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-1 text-xs text-gray-500">—</div>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-700">Context providers</div>
            {Array.isArray(contributes.contextProviders) && contributes.contextProviders.length ? (
              <ul className="mt-1 list-disc pl-4">
                {contributes.contextProviders.map((p: any) => (
                  <li key={String(p.id)} className="text-xs text-gray-700">
                    <span className="font-mono text-[11px]">{String(p.id)}</span> — {String(p.name || "")}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-1 text-xs text-gray-500">—</div>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-700">Notebook providers</div>
            {Array.isArray(contributes.notebookProviders) && contributes.notebookProviders.length ? (
              <ul className="mt-1 list-disc pl-4">
                {contributes.notebookProviders.map((p: any) => (
                  <li key={String(p.id)} className="text-xs text-gray-700">
                    <span className="font-mono text-[11px]">{String(p.id)}</span> — {String(p.name || "")}
                    {Array.isArray(p.kernels) && p.kernels.length ? ` (kernels: ${p.kernels.join(", ")})` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-1 text-xs text-gray-500">—</div>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-700">Workbook actions</div>
            {Array.isArray(contributes.workbookActions) && contributes.workbookActions.length ? (
              <ul className="mt-1 list-disc pl-4">
                {contributes.workbookActions.map((a: any) => (
                  <li key={String(a.id)} className="text-xs text-gray-700">
                    <span className="font-mono text-[11px]">{String(a.id)}</span> — {String(a.title || "")}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-1 text-xs text-gray-500">—</div>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}
