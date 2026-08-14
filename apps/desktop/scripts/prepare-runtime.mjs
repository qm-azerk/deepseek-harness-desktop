import { access, cp, mkdir, readdir, readFile, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = resolve(desktopRoot, '..', '..')
const runtimeRoot = resolve(desktopRoot, 'runtime')
const runtimeArchive = resolve(desktopRoot, 'harness-runtime.tar.gz')
const runtimePackageScope = resolve(runtimeRoot, 'node_modules', '@deepseek-ai')
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const tar = process.platform === 'win32' ? 'tar.exe' : 'tar'

async function readManifest(directory) {
  return JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'))
}

async function packageDirectories() {
  const directories = []
  for (const root of ['vendor', 'apps']) {
    const parent = resolve(repositoryRoot, root)
    for (const entry of await readdir(parent, { withFileTypes: true })) {
      if (entry.isDirectory()) directories.push(resolve(parent, entry.name))
    }
  }
  const packagesRoot = resolve(repositoryRoot, 'packages')
  for (const category of await readdir(packagesRoot, { withFileTypes: true })) {
    if (!category.isDirectory()) continue
    const categoryRoot = resolve(packagesRoot, category.name)
    for (const entry of await readdir(categoryRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) directories.push(resolve(categoryRoot, entry.name))
    }
  }
  return directories
}

async function pathExists(target) {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

async function copyRuntimePackage(sourceRoot, packageName) {
  const destinationRoot = resolve(runtimePackageScope, packageName)
  await mkdir(destinationRoot, { recursive: true })
  await cp(resolve(sourceRoot, 'package.json'), resolve(destinationRoot, 'package.json'))
  for (const entry of ['lib', 'bin.js', 'config']) {
    const source = resolve(sourceRoot, entry)
    if (await pathExists(source)) {
      await cp(source, resolve(destinationRoot, entry), { recursive: true })
    }
  }
}

async function includeWorkspaceRuntimeClosure() {
  const workspacePackages = new Map()
  for (const directory of await packageDirectories()) {
    if (!await pathExists(resolve(directory, 'package.json'))) continue
    const manifest = await readManifest(directory)
    workspacePackages.set(manifest.name, { directory, manifest })
  }

  const required = new Set()
  const pending = []
  const add = name => {
    if (!workspacePackages.has(name) || required.has(name)) return
    required.add(name)
    pending.push(name)
  }
  for (const entry of await readdir(runtimePackageScope, { withFileTypes: true })) {
    add(`@deepseek-ai/${entry.name}`)
  }

  while (pending.length) {
    const name = pending.pop()
    const { manifest } = workspacePackages.get(name)
    for (const dependencies of [manifest.dependencies, manifest.optionalDependencies, manifest.peerDependencies]) {
      for (const [dependency, version] of Object.entries(dependencies ?? {})) {
        if (typeof version === 'string' && (version.startsWith('workspace:') || version.startsWith('link:'))) add(dependency)
      }
    }
  }

  for (const name of required) {
    const destination = resolve(runtimePackageScope, name.replace('@deepseek-ai/', ''))
    if (!await pathExists(destination)) {
      await copyRuntimePackage(workspacePackages.get(name).directory, name.replace('@deepseek-ai/', ''))
    }
  }
}

await rm(runtimeRoot, { recursive: true, force: true })
await rm(runtimeArchive, { force: true })

const child = spawn(pnpm, ['--config.node-linker=hoisted', '--filter', '@deepseek-ai/dsh', 'deploy', '--legacy', '--prod', runtimeRoot], {
  cwd: repositoryRoot,
  shell: process.platform === 'win32',
  stdio: 'inherit',
})

await new Promise((resolve, reject) => {
  child.once('error', reject)
  child.once('exit', code => {
    if (code === 0) resolve()
    else reject(new Error(`pnpm deploy exited with code ${code ?? 'unknown'}.`))
  })
})

await includeWorkspaceRuntimeClosure()

const archive = spawn(tar, ['-czf', runtimeArchive, '-C', runtimeRoot, '.'], {
  stdio: 'inherit',
})

await new Promise((resolve, reject) => {
  archive.once('error', reject)
  archive.once('exit', code => {
    if (code === 0) resolve()
    else reject(new Error(`tar exited with code ${code ?? 'unknown'}.`))
  })
})
