# DeepSeek Harness Desktop

[English](README.md) | 中文

此工作区将构建后的 `@deepseek-ai/dsh` 运行时打包为 Windows 桌面应用。Electron 主进程会先将内置生产运行时解压到单用户数据目录，再在仅限回环地址的临时端口启动 Harness 服务，并在启用安全隔离的 BrowserWindow 中加载界面。用户设置和会话保存在同一单用户数据目录中，安装目录在运行时保持只读。

在仓库根目录执行以下命令构建 Windows 安装程序：

```sh
pnpm run desktop:package
```

安装程序输出到 `apps/desktop/release/`。它内置 Electron 和部署后的 DSH 运行时，因此目标电脑无需安装 Node.js 或 pnpm。
