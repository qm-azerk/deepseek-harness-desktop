# Agent Note: Electron desktop installer

Status: implemented

English | [Chinese](2026-08-14-electron-desktop-installer.zh.md)

## Problem

The Web profile is convenient for development but requires a separately managed Node.js runtime and a manually launched local server. Windows users need an installable desktop application that owns its runtime and starts the browser surface without exposing the service to a network interface.

## Decision

`apps/desktop` owns a Windows Electron wrapper and NSIS installer. Its packaging script builds the workspace, uses `pnpm deploy --legacy --prod` to stage the built `@deepseek-ai/dsh` runtime, and archives that runtime into Electron's resources directory.

At launch, the Electron main process extracts the versioned runtime archive into its per-user data directory, chooses a loopback ephemeral port, starts the staged DSH CLI with Electron's embedded Node runtime, and loads the local URL only after its HTTP server responds. The child process receives a per-user `DSH_HOME`, while the installed resource directory remains immutable. Closing the application stops the local server.

## Alternatives considered

**Require Node.js and launch the existing Web command.** Rejected because it leaves installation, version compatibility, and service lifetime to every user.

**Embed the frontend directly in Electron.** Rejected because the Web profile already owns API routes, configuration composition, static asset serving, and browser trust behavior. Reusing it prevents a second product surface from drifting.

**Bind a fixed port.** Rejected because a desktop launch must tolerate another local program using the usual development port. The wrapper selects an ephemeral loopback port for each launch.

## Consequences

The installer contains a larger runtime payload than a browser shortcut, but target machines do not need Node.js or pnpm. The application remains local-only and maintains the existing Web profile as the single UI backend. Windows SmartScreen may warn until a release signing certificate is configured.
