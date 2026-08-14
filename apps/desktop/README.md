# DeepSeek Harness Desktop

English | [中文](README.zh.md)

This workspace packages the built `@deepseek-ai/dsh` runtime as a Windows desktop application. The Electron main process extracts the bundled production runtime into its per-user data directory, starts its local Harness server on a loopback-only, ephemeral port, then loads that server in a hardened BrowserWindow. User settings and sessions use the same per-user data directory; the installed program files stay read-only at runtime.

Build a Windows installer from the repository root with:

```sh
pnpm run desktop:package
```

The installer is written to `apps/desktop/release/`. It contains Electron and the deployed DSH runtime, so an installed copy does not require Node.js or pnpm on the target computer.
