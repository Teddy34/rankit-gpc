"use client";

import { FormEvent, KeyboardEvent, useRef, useState, useTransition } from "react";
import { runAdminCommand, type AdminConsoleResult } from "./admin-console-actions";

type TerminalEntry = { command: string; result: AdminConsoleResult };

export function AdminConsole() {
  const [command, setCommand] = useState("");
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const outputRef = useRef<HTMLDivElement>(null);
  const commandHistory = entries.map((entry) => entry.command);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitted = command.trim();
    if (!submitted || isPending) return;
    setCommand("");
    setExpanded(true);
    startTransition(async () => {
      let result: AdminConsoleResult;
      try {
        result = await runAdminCommand(submitted);
      } catch {
        result = { status: "error", message: "Command failed. Check the server logs and try again." };
      }
      setEntries((current) => [...current, { command: submitted, result }]);
      setHistoryIndex(commandHistory.length + 1);
      requestAnimationFrame(() => outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight }));
    });
  }

  function navigateHistory(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    if (commandHistory.length === 0) return;
    const nextIndex = event.key === "ArrowUp"
      ? Math.max(0, historyIndex - 1)
      : Math.min(commandHistory.length, historyIndex + 1);
    setHistoryIndex(nextIndex);
    setCommand(commandHistory[nextIndex] ?? "");
  }

  return (
    <section className={`admin-terminal${expanded ? " expanded" : ""}`} aria-label="Administrator command console">
      <header className="terminal-header">
        <span className="terminal-lights" aria-hidden="true"><i /><i /><i /></span>
        <strong>admin@gpc:~</strong>
        <span>Run <code>help</code> for commands</span>
        <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-controls="admin-terminal-output">
          {expanded ? "Collapse" : "Expand"}
        </button>
      </header>
      {expanded ? <div className="terminal-output" id="admin-terminal-output" ref={outputRef} role="log" aria-live="polite">
        {entries.length === 0 ? <p className="terminal-muted">Console ready. Player selectors accept an ID, email, or exact display name.</p> : null}
        {entries.map((entry, index) => <div className="terminal-entry" key={`${entry.command}-${index}`}>
          <p><span>$</span> {entry.command}</p>
          <pre className={entry.result.status}>{entry.result.message}</pre>
        </div>)}
        {isPending ? <p className="terminal-muted">Running…</p> : null}
      </div> : null}
      <form className="terminal-input" onSubmit={submit}>
        <label htmlFor="admin-command">$</label>
        <input
          id="admin-command"
          name="command"
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          onKeyDown={navigateHistory}
          placeholder="help"
          autoComplete="off"
          spellCheck={false}
          disabled={isPending}
          aria-label="Administrator command"
        />
        <button type="submit" disabled={isPending || !command.trim()}>{isPending ? "…" : "Run"}</button>
      </form>
    </section>
  );
}
