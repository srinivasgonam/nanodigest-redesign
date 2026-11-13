/**
 * Packages the WordPress theme and plugin into two zip files that can be
 * uploaded in wp-admin (Appearance > Themes > Add New > Upload, and
 * Plugins > Add New > Upload).
 *
 * Run through `npm run build:wp`, which builds the app into dist-wp/ first.
 *
 *   release/nanodigest-theme.zip    -> installs as wp-content/themes/nanodigest
 *   release/nanodigest-backend.zip  -> installs as wp-content/plugins/nanodigest-backend
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateRawSync } from 'node:zlib'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appBuild = path.join(root, 'dist-wp')
const release = path.join(root, 'release')

if (!existsSync(path.join(appBuild, '.vite', 'manifest.json'))) {
  console.error('dist-wp/.vite/manifest.json is missing. Run "npm run build:wp" instead of this script directly.')
  process.exit(1)
}

rmSync(release, { recursive: true, force: true })
mkdirSync(release, { recursive: true })

// Theme = PHP templates + the built app + a screenshot for the Themes screen.
const themeDir = path.join(release, 'nanodigest')
cpSync(path.join(root, 'wordpress', 'nanodigest'), themeDir, { recursive: true })
cpSync(appBuild, path.join(themeDir, 'dist'), { recursive: true })
rmSync(path.join(themeDir, 'dist', 'index.html'), { force: true })
cpSync(path.join(root, 'assets', 'images', 'nanodigest-logo.png'), path.join(themeDir, 'screenshot.png'))
// Web servers list a folder's files when it has no index file.
writeFileSync(path.join(themeDir, 'dist', 'index.php'), '<?php\n// Silence is golden.\n')

const pluginDir = path.join(release, 'nanodigest-backend')
cpSync(path.join(root, 'wordpress', 'nanodigest-backend'), pluginDir, { recursive: true })

zipFolder(themeDir, path.join(release, 'nanodigest-theme.zip'))
zipFolder(pluginDir, path.join(release, 'nanodigest-backend.zip'))
rmSync(themeDir, { recursive: true, force: true })
rmSync(pluginDir, { recursive: true, force: true })

for (const name of ['nanodigest-theme.zip', 'nanodigest-backend.zip']) {
  const size = statSync(path.join(release, name)).size
  console.log(`release/${name}  ${(size / 1024).toFixed(0)} KB`)
}

/* ------------------------------------------------------------------------ */
/* Minimal zip writer. Entry names always use forward slashes, which is what  */
/* WordPress on a Linux host needs (some Windows zip tools write backslashes). */
/* ------------------------------------------------------------------------ */

function listFiles(dir, prefix = '') {
  const entries = []
  for (const name of readdirSync(dir).sort()) {
    const full = path.join(dir, name)
    const relative = prefix ? `${prefix}/${name}` : name
    if (statSync(full).isDirectory()) entries.push(...listFiles(full, relative))
    else entries.push({ full, relative })
  }
  return entries
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i]
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function zipFolder(folder, zipPath) {
  const top = path.basename(folder)
  const local = []
  const central = []
  let offset = 0

  // Fixed timestamp (2026-01-01 00:00) so identical sources give identical zips.
  const dosTime = 0
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1

  for (const file of listFiles(folder)) {
    const name = Buffer.from(`${top}/${file.relative}`, 'utf8')
    const data = readFileSync(file.full)
    const compressed = deflateRawSync(data, { level: 9 })
    const crc = crc32(data)

    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50, 0)
    header.writeUInt16LE(20, 4) // version needed
    header.writeUInt16LE(0x0800, 6) // UTF-8 names
    header.writeUInt16LE(8, 8) // deflate
    header.writeUInt16LE(dosTime, 10)
    header.writeUInt16LE(dosDate, 12)
    header.writeUInt32LE(crc, 14)
    header.writeUInt32LE(compressed.length, 18)
    header.writeUInt32LE(data.length, 22)
    header.writeUInt16LE(name.length, 26)
    local.push(header, name, compressed)

    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(0x0314, 4) // made by: Unix
    entry.writeUInt16LE(20, 6)
    entry.writeUInt16LE(0x0800, 8)
    entry.writeUInt16LE(8, 10)
    entry.writeUInt16LE(dosTime, 12)
    entry.writeUInt16LE(dosDate, 14)
    entry.writeUInt32LE(crc, 16)
    entry.writeUInt32LE(compressed.length, 20)
    entry.writeUInt32LE(data.length, 24)
    entry.writeUInt16LE(name.length, 28)
    entry.writeUInt32LE((0o100644 << 16) >>> 0, 38) // regular file, rw-r--r--
    entry.writeUInt32LE(offset, 42)
    central.push(entry, name)

    offset += header.length + name.length + compressed.length
  }

  const centralSize = central.reduce((total, part) => total + part.length, 0)
  const count = central.length / 2
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(count, 8)
  end.writeUInt16LE(count, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)

  writeFileSync(zipPath, Buffer.concat([...local, ...central, end]))
}
