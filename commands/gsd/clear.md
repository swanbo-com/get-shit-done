---
name: gsd:clear
description: Start a fresh Codex CLI session (context reset)
---

<objective>
Provide a safe, explicit way to reset context in Codex CLI.
Codex CLI does not support /clear, so this command tells the user how to restart.
</objective>

<response>
GSD > RESET SESSION

Codex CLI doesn't support /clear.

To reset context:
1. Exit Codex (Ctrl+C or /exit if available)
2. Restart: `codex`

If you see a reset command in the slash menu (e.g., /new or /reset), you can use that instead.
</response>
