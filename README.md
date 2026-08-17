# DeepSeek Harness

English | [中文](README.zh.md)

DeepSeek Harness (`dsh`) is an open-source agent harness developed by [DeepSeek AI](https://deepseek.com).

It uses an architecture where **everything is a plugin**, and is powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper).

## Developer preview

DeepSeek Harness is currently in _developer preview_ and is iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

## Desktop app

DeepSeek Harness ships as a Windows desktop application. The Electron shell packages the built `dsh` runtime ([apps/desktop](apps/desktop/README.md)): on launch it extracts the runtime into the per-user data directory, starts the local Harness server on loopback-only `http://127.0.0.1:3080`, and loads the Web UI in a hardened `BrowserWindow`. Settings and sessions live in the same per-user data directory, so the installed program files stay read-only at runtime. An installed copy needs no Node.js or pnpm.

Build the installer from a repository checkout:

```sh
pnpm run desktop:package
```

The installer is written to `apps/desktop/release/`.

## Architecture

Every part of the product is a plugin: model adapters, the tool registry, the session log, and the agent loop itself all mount into a shared [Cordis](docs/cordis-primer.md) context. You extend the harness by mounting a plugin beside the others, and every registration is an effect that unwinds when its plugin unloads.

A running `dsh` is a plugin tree composed at boot from ordered layers. A **profile** stacks the **bundles** it lists, then applies your own patch layers. The shipped `web` profile powers the Web UI; `headless` runs one-shot tasks with no server.

Capabilities are swappable through **capability seams**, each spanning a Service Definition, a Service Provider, and a Consumer. Swapping one provider moves the whole product: pointing the filesystem and subprocess providers at a remote sandbox carries Bash, terminals, and LSP navigation with them.

The session log is the source of the context the model sees — anything that reaches a model request is reconstructable from the log.

Read the [architecture documentation](docs/architecture.md) before changing packages.

## Features

- **Model configuration** — DeepSeek API keys, catalog providers, and custom OpenAI-compatible endpoints; credentials stay write-only ([configure models](docs/user/guide/providers.md))
- **Workspaces** — add project directories the agent may read and edit ([workspaces](docs/subsystems/workspace.md))
- **Sessions** — durable chat sessions that resume, fork, and export, with auto-generated titles ([sessions](docs/subsystems/session.md))
- **Filesystem** — read, write, and edit files under the active policy ([filesystem](docs/subsystems/filesystem.md))
- **Shell, terminal, and subprocesses** — bash, PowerShell, persistent PTY sessions, and process control ([shell](docs/subsystems/shell.md))
- **Web access** — search and fetch pages ([web](docs/subsystems/web.md))
- **LSP navigation** — language-server-powered code navigation ([LSP](docs/subsystems/lsp.md))
- **Code runtime** — run model-written programs with typed results ([code runtime](docs/subsystems/code-runtime.md))
- **Skills** — reusable, invocable capability packages ([skills](docs/subsystems/skills.md))
- **Subagents** — delegate work to child agents and continue them later ([subagents](docs/subsystems/subagent.md))
- **Workflows** — orchestrate multiple agents ([workflows](docs/subsystems/workflow.md))
- **Background jobs** — long-running work collected or stopped through `job_*` tools ([jobs](docs/subsystems/jobs.md))
- **Goals** — persist a same-session objective the agent keeps working toward ([goals](docs/subsystems/goal.md))
- **Plan mode** — review a plan before the agent executes ([plan mode](docs/subsystems/plan.md))
- **Approvals and sandboxing** — permission policies and process confinement; the UI asks before operations that need approval ([approvals](docs/subsystems/approval.md))
- **Human commands** — slash commands that dispatch without a model turn ([commands](docs/subsystems/commands.md))
- **Scheduled reminders** — follow-ups at a wall-clock time ([schedule](docs/subsystems/schedule.md))
- **Context compaction** — compress long session history ([compaction](docs/subsystems/compaction.md))
- **Python SDK** — drive the harness from Python ([python/README.md](python/README.md))
- **Plugin development** — every part of the product is an extension point ([develop a plugin](docs/user/develop/basic/index.md))
