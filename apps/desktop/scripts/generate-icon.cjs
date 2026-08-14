const { mkdir, readFile, writeFile } = require('node:fs/promises')
const path = require('node:path')

const sharp = require(require.resolve('sharp', {
  paths: [path.resolve(__dirname, '..', '..', '..', 'node_modules', '.pnpm', 'node_modules')],
}))

const desktopRoot = path.resolve(__dirname, '..')
const source = path.resolve(desktopRoot, '..', 'web', 'public', 'favicon.svg')
const output = path.resolve(desktopRoot, 'assets', 'icon.png')
const icoOutput = path.resolve(desktopRoot, 'assets', 'icon.ico')

function createIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  let offset = header.length + images.length * 16
  const directories = images.map(({ size, png }) => {
    const directory = Buffer.alloc(16)
    directory.writeUInt8(size === 256 ? 0 : size, 0)
    directory.writeUInt8(size === 256 ? 0 : size, 1)
    directory.writeUInt16LE(1, 4)
    directory.writeUInt16LE(32, 6)
    directory.writeUInt32LE(png.length, 8)
    directory.writeUInt32LE(offset, 12)
    offset += png.length
    return directory
  })

  return Buffer.concat([header, ...directories, ...images.map(({ png }) => png)])
}

async function renderPng(svg, size) {
  return sharp(svg, { density: 512 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

async function main() {
  const svg = await readFile(source)
  const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256]
  const images = await Promise.all(sizes.map(async size => ({ size, png: await renderPng(svg, size) })))
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, await renderPng(svg, 512))
  await writeFile(icoOutput, createIco(images))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
