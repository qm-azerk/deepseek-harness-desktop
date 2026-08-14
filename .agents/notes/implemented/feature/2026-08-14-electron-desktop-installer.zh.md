# Agent Note: Electron desktop installer

Status: implemented

English | [中文](2026-08-14-electron-desktop-installer.md)

## Problem

Web profile 便于开发，但它依赖单独维护的 Node.js 运行时和手工启动的本地服务。Windows 用户需要一个可安装的桌面应用，由应用自己管理运行时，并在不向网络接口暴露服务的前提下启动浏览器界面。

## Decision

`apps/desktop` 负责 Windows Electron 包装器和 NSIS 安装程序。打包脚本会构建工作区，使用 `pnpm deploy --legacy --prod` 暂存已构建的 `@deepseek-ai/dsh` 运行时，并将该运行时归档后放入 Electron 的资源目录。

启动时，Electron 主进程将带版本的运行时归档解压到单用户数据目录，选择一个仅限回环地址的临时端口，使用 Electron 内置的 Node 运行时启动暂存的 DSH CLI，并在本地 HTTP 服务响应后才加载 URL。子进程获得单用户的 `DSH_HOME`，而安装后的资源目录保持不可变。关闭应用会停止本地服务。

## Alternatives considered

**要求安装 Node.js 并启动既有 Web 命令。** 未采用，因为这样会把安装、版本兼容性和服务生命周期交给每一位用户。

**在 Electron 中直接嵌入前端。** 未采用，因为 Web profile 已负责 API 路由、配置组合、静态资源服务和浏览器信任行为。复用它可以避免第二套产品界面逐渐偏离。

**绑定固定端口。** 未采用，因为桌面应用启动时应能容忍常用开发端口已被其他本地程序使用。包装器会在每次启动时选择临时回环端口。

## Consequences

安装程序的运行时体积会大于浏览器快捷方式，但目标电脑无需 Node.js 或 pnpm。应用仍只在本地运行，并将现有 Web profile 保持为唯一的 UI 后端。在配置发布签名证书前，Windows SmartScreen 可能会显示警告。
