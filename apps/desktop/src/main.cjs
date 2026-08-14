const { app, BrowserWindow, dialog, Menu, Tray } = require('electron')
const { spawn, execFile } = require('node:child_process')
const { randomBytes } = require('node:crypto')
const { access, mkdir, readFile, rename, stat, writeFile } = require('node:fs/promises')
const http = require('node:http')
const net = require('node:net')
const path = require('node:path')
const { promisify } = require('node:util')

const HARNESS_PORT = 3080
let harnessProcess
let mainWindow
let tray
let directoryPickerBridge
let directoryPickerBridgeUrl
let isQuitting = false
const directoryPickerBridgeToken = randomBytes(32).toString('hex')
const execFileAsync = promisify(execFile)

function runtimeArchive() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'harness-runtime.tar.gz')
    : path.join(__dirname, '..', 'harness-runtime.tar.gz')
}

async function runtimeDirectory() {
  const archive = runtimeArchive()
  const archiveInfo = await stat(archive)
  const stamp = `${app.getVersion()}:${archiveInfo.size}`
  const root = path.join(app.getPath('userData'), 'runtime')
  const runtime = path.join(root, stamp.replace(':', '-'))
  const entry = path.join(runtime, 'lib', 'bin.js')
  const marker = path.join(runtime, '.runtime-stamp')
  try {
    await access(entry)
    if (await readFile(marker, 'utf8') === stamp) return runtime
  } catch {
  }

  const staging = path.join(root, `${stamp.replace(':', '-')}.extract-${process.pid}-${Date.now()}`)
  await mkdir(staging, { recursive: true })
  await execFileAsync('tar.exe', ['-xzf', archive, '-C', staging], { windowsHide: true })
  await access(path.join(staging, 'lib', 'bin.js'))
  await writeFile(path.join(staging, '.runtime-stamp'), stamp)
  try {
    await rename(staging, runtime)
    return runtime
  } catch {
    try {
      await access(entry)
      if (await readFile(marker, 'utf8') === stamp) return runtime
    } catch {
    }
    return staging
  }
}

function ensureHarnessPortAvailable() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer()
    probe.once('error', reject)
    probe.listen(HARNESS_PORT, '127.0.0.1', () => probe.close(error => error ? reject(error) : resolve()))
  })
}

function isHarnessServer(url) {
  return new Promise(resolve => {
    const request = http.get(url, response => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', chunk => {
        if (body.length < 8192) body += chunk
      })
      response.on('end', () => {
        resolve(Boolean(
          response.statusCode && response.statusCode < 500 &&
          body.includes('window.__DSH_BOOT__'),
        ))
      })
    })
    request.once('error', () => resolve(false))
    request.setTimeout(1500, () => {
      request.destroy()
      resolve(false)
    })
  })
}

function waitForServer(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, response => {
        response.resume()
        if (response.statusCode && response.statusCode < 500) {
          resolve()
          return
        }
        retry()
      })
      request.once('error', retry)
      request.setTimeout(1000, () => request.destroy())
    }
    const retry = () => {
      if (Date.now() >= deadline) {
        reject(new Error(`DeepSeek Harness did not become available at ${url}.`))
        return
      }
      setTimeout(attempt, 200)
    }
    attempt()
  })
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

async function startDirectoryPickerBridge() {
  if (directoryPickerBridgeUrl) return directoryPickerBridgeUrl
  directoryPickerBridge = http.createServer((request, response) => {
    if (request.method !== 'POST' || request.url !== '/pick-directory') {
      sendJson(response, 404, { error: 'not found' })
      return
    }
    if (request.headers['x-dsh-directory-picker-token'] !== directoryPickerBridgeToken) {
      sendJson(response, 403, { error: 'forbidden' })
      return
    }
    void dialog.showOpenDialog(mainWindow, {
      title: '选择工作区目录',
      properties: ['openDirectory', 'createDirectory'],
    }).then(result => {
      sendJson(response, 200, { path: result.canceled ? null : result.filePaths[0] ?? null })
    }, error => {
      sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) })
    })
  })
  await new Promise((resolve, reject) => {
    directoryPickerBridge.once('error', reject)
    directoryPickerBridge.listen(0, '127.0.0.1', () => {
      const address = directoryPickerBridge.address()
      if (typeof address !== 'object' || address === null) {
        reject(new Error('Unable to allocate the directory picker bridge port.'))
        return
      }
      directoryPickerBridgeUrl = `http://127.0.0.1:${address.port}/pick-directory`
      resolve()
    })
  })
  return directoryPickerBridgeUrl
}

async function startHarness() {
  const url = `http://127.0.0.1:${HARNESS_PORT}`
  try {
    await ensureHarnessPortAvailable()
  } catch (error) {
    if (await isHarnessServer(url)) return url
    throw error
  }
  const directoryPickerUrl = await startDirectoryPickerBridge()
  const runtime = await runtimeDirectory()
  const executable = path.join(runtime, 'lib', 'bin.js')
  const home = path.join(app.getPath('userData'), 'harness')
  harnessProcess = spawn(process.execPath, [executable, 'web', '--host', '127.0.0.1', '--port', String(HARNESS_PORT)], {
    cwd: app.getPath('documents'),
    env: {
      ...process.env,
      DSH_HOME: home,
      DSH_ELECTRON_DIRECTORY_PICKER_URL: directoryPickerUrl,
      DSH_ELECTRON_DIRECTORY_PICKER_TOKEN: directoryPickerBridgeToken,
      ELECTRON_RUN_AS_NODE: '1',
    },
    stdio: 'ignore',
    windowsHide: true,
  })
  await waitForServer(url)
  return url
}

function stopHarness() {
  if (harnessProcess && !harnessProcess.killed) harnessProcess.kill()
  harnessProcess = undefined
}

function showMainWindow() {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function createTray() {
  tray = new Tray(path.join(__dirname, '..', 'assets', 'icon.png'))
  tray.setToolTip('DeepSeek Harness')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open DeepSeek Harness', click: showMainWindow },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]))
  tray.on('click', showMainWindow)
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    backgroundColor: '#f7f8fa',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  mainWindow.setMenuBarVisibility(false)
  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('close', event => {
    if (isQuitting) return
    event.preventDefault()
    mainWindow.hide()
  })
  mainWindow.on('closed', () => { mainWindow = undefined })
  await mainWindow.loadFile(path.join(__dirname, 'splash.html'))

  const url = await startHarness()
  if (!mainWindow) return
  await mainWindow.loadURL(url)
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  Menu.setApplicationMenu(null)
  app.on('second-instance', () => {
    showMainWindow()
  })

  app.whenReady().then(async () => {
    createTray()
    await createWindow()
  }).catch(async error => {
    stopHarness()
    await dialog.showMessageBox({
      type: 'error',
      title: 'DeepSeek Harness',
      message: 'DeepSeek Harness could not start.',
      detail: error instanceof Error ? error.message : String(error),
    })
    app.quit()
  })
}

app.on('before-quit', () => {
  isQuitting = true
  stopHarness()
  directoryPickerBridge?.close()
  directoryPickerBridge = undefined
  directoryPickerBridgeUrl = undefined
  tray?.destroy()
  tray = undefined
})
