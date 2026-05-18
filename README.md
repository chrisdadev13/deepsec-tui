# deepsec-tui

`deepsec-tui` is a terminal UI for [deepsec](https://github.com/vercel-labs/deepsec). It gives you a keyboard-first way to initialize a workspace, run deepsec workflows, review findings, and inspect project-level scan status without leaving the terminal.

## Demo

<img width="1508" height="867" alt="deepsec-tui dashboard showing findings and project status" src="https://github.com/user-attachments/assets/4de57c5b-be3a-443f-a7a4-3ece78783bac" />

<details>
<summary>More screenshots</summary>

### Process Flow

<img width="1767" height="1029" alt="deepsec-tui finding details view with vulnerability context" src="https://github.com/user-attachments/assets/599c9ebf-3df2-4c3c-9b15-bb518b0ebc20" />

### Finding Details

<img width="1765" height="1028" alt="deepsec-tui action dialog for running deepsec workflows" src="https://github.com/user-attachments/assets/6fa1520a-9b96-44ee-8d49-fbf51cdd313b" />

</details>

## What It Does

- Detects the current `.deepsec` workspace automatically
- Guides first-time setup with `deepsec init` and dependency install
- Opens form-based flows for `scan`, `process`, `triage`, `revalidate`, `enrich`, `export`, and `metrics`
- Shows the exact `deepsec` command before execution
- Presents findings in a searchable dashboard with severity-aware sorting
- Lets you open finding details and copy a finding prompt to the clipboard

## Interface Overview

- `Init` view: shown when no `.deepsec` workspace exists yet
- `Dashboard` view: findings list plus project metadata once a workspace is available
- `Action` overlays: interactive forms for running deepsec commands without memorizing flags

The app resolves the workspace from the current directory, a parent directory containing `.deepsec`, or the current git root.

## Prerequisites

- [Bun](https://bun.sh)
- A working [deepsec](https://github.com/vercel-labs/deepsec) project or repository
- `git` on your `PATH`
- `npx` and `pnpm` available if you want to use the built-in workspace initialization flow

## Install

```bash
bun install
```

## Run

Start the TUI from your repository root or any directory inside a deepsec workspace:

```bash
bun run dev
```

If no `.deepsec` directory exists, the app opens the init flow first. If a workspace already exists, it opens the findings dashboard.

## Build

Create a compiled binary:

```bash
bun run build
```

Run the full packaging step with typechecking:

```bash
bun run package
```

## Keyboard Shortcuts

- `Ctrl+I`: initialize a workspace
- `Ctrl+S`: open scan
- `Ctrl+P`: open process
- `Ctrl+T`: open triage
- `Ctrl+V`: open revalidate
- `Ctrl+E`: open enrich
- `Ctrl+X`: open export
- `Ctrl+M`: open metrics
- `Enter`: open the selected finding's details
- `/`: focus findings search
- `S`: cycle finding sort
- `R`: reverse finding sort order
- `C`: copy the selected finding prompt
- `Esc`: close dialogs or clear search

## Process Workflow

The `process` flow supports multiple execution modes:

- Full project scan
- Working changes
- Staged changes
- Diff from a ref
- Specific files
- Files from a list

This makes the TUI useful both for broad audits and tight review loops on active code changes.

## Notes

- Commands run against the resolved `.deepsec` directory for the current workspace
- Some actions stay disabled until prerequisite data exists, such as candidates from `scan` or findings from `process`
- The dashboard adapts to terminal width and shows more context when more columns are available
