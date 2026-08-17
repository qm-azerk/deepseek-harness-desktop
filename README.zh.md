# DeepSeek Harness

[English](README.md) | 中文

DeepSeek Harness（`dsh`）是由 [DeepSeek AI](https://deepseek.com) 开发的开源 agent harness（智能体框架）。

它采用**一切皆插件**的架构，并由 [Cordis](https://github.com/cordiverse/cordis) 驱动，其设计参见论文 [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper)。

## 开发者预览

DeepSeek Harness 目前处于 _开发者预览_ 阶段，正在快速迭代。**未来将出现破坏兼容性的变更。**

## 桌面应用

DeepSeek Harness 以 Windows 桌面应用的形式发布。Electron 外壳打包了构建好的 `dsh` 运行时（[apps/desktop](apps/desktop/README.md)）：启动时把运行时解压到单用户数据目录，在仅限回环地址的 `http://127.0.0.1:3080` 启动本地 Harness 服务，并在启用安全隔离的 `BrowserWindow` 中加载 Web UI。设置与会话保存在同一单用户数据目录中，安装目录在运行时保持只读。安装后的副本无需 Node.js 或 pnpm。

在仓库检出中构建安装程序：

```sh
pnpm run desktop:package
```

安装程序输出到 `apps/desktop/release/`。

## 架构

产品的每一部分都是插件：模型适配器、工具注册表、会话日志，以及 agent loop 本身，都挂载到共享的 [Cordis](docs/cordis-primer.md) 上下文中。你可以在其他插件旁挂载一个新插件来扩展 harness；每个注册都是可逆的副作用，插件卸载时自动解除。

运行中的 `dsh` 是在启动时按有序层次组装的插件树。**profile** 按列表叠放**组合包**，再应用你自己的 patch 层。随发行版交付的 `web` profile 驱动 Web UI；`headless` 则以无服务器方式运行一次性任务。

能力通过**能力 seam** 整体替换，每个 seam 涵盖 Service Definition、Service Provider 与 Consumer 三种角色。替换一个提供方即可带动整个产品：把文件系统与子进程提供方指向远程沙箱，Bash、终端与 LSP 导航会随之迁移。

会话日志是模型所看到上下文的来源——任何到达模型请求的内容都能从日志重建。

修改 packages 之前，请先阅读[架构文档](docs/architecture.md)。

## 功能

- **模型配置** — DeepSeek API 密钥、目录提供方与自定义 OpenAI 兼容端点；凭据保持只写（[配置模型](docs/user/guide/providers.md)）
- **工作区** — 添加 agent 可读取与编辑的项目目录（[工作区](docs/subsystems/workspace.md)）
- **会话** — 可恢复、可 fork、可导出的持久聊天会话，并自动生成标题（[会话](docs/subsystems/session.md)）
- **文件系统** — 在生效策略下读取、写入与编辑文件（[文件系统](docs/subsystems/filesystem.md)）
- **Shell、终端与子进程** — bash、PowerShell、持久 PTY 会话与进程控制（[shell](docs/subsystems/shell.md)）
- **Web 访问** — 搜索与抓取网页（[web](docs/subsystems/web.md)）
- **LSP 导航** — 基于语言服务器的代码导航（[LSP](docs/subsystems/lsp.md)）
- **代码运行时** — 运行模型编写的程序并返回类型化结果（[代码运行时](docs/subsystems/code-runtime.md)）
- **skill（技能）** — 可复用、可调用的能力包（[skills](docs/subsystems/skills.md)）
- **subagent** — 把工作委派给子 agent，之后可继续（[subagents](docs/subsystems/subagent.md)）
- **工作流** — 编排多个 agent（[工作流](docs/subsystems/workflow.md)）
- **后台任务** — 通过 `job_*` 工具收集或停止的长时任务（[后台任务](docs/subsystems/jobs.md)）
- **目标** — 持久化同会话目标，agent 持续朝其推进（[目标](docs/subsystems/goal.md)）
- **计划模式** — 在执行前先评审计划（[计划模式](docs/subsystems/plan.md)）
- **审批与沙箱** — 权限策略与进程隔离；UI 会在需要审批的操作前征询（[审批](docs/subsystems/approval.md)）
- **用户命令** — 不经模型轮次即可分发的斜杠命令（[命令](docs/subsystems/commands.md)）
- **定时提醒** — 在指定时刻发起跟进（[定时提醒](docs/subsystems/schedule.md)）
- **上下文压缩** — 压缩长会话历史（[压缩](docs/subsystems/compaction.md)）
- **Python SDK** — 用 Python 驱动 harness（[python/README.md](python/README.md)）
- **插件开发** — 产品的每一部分都是扩展点（[开发插件](docs/user/develop/basic/index.md)）
