import { exec } from 'child_process'
import { promisify } from 'util'
import { copyFile, access, writeFile } from 'fs/promises'
import { desktopCapturer, screen, nativeImage } from 'electron'
import dbus, { Variant } from 'dbus-next'

const execAsync = promisify(exec)

export interface CaptureOptions {
  mode?: 'fullscreen' | 'window' | 'region' | 'display'
  displayId?: number
  sourceId?: string
  region?: { x: number; y: number; width: number; height: number }
  format?: 'png' | 'jpg'
  quality?: number
}

async function fileExists(filepath: string): Promise<boolean> {
  try {
    await access(filepath)
    return true
  } catch {
    return false
  }
}

async function commandExists(command: string): Promise<boolean> {
  try {
    await execAsync(`command -v ${command}`)
    return true
  } catch {
    return false
  }
}

async function writeImage(buffer: Buffer, filepath: string, opts: CaptureOptions) {
  if (opts.format === 'jpg') {
    const img = nativeImage.createFromBuffer(buffer)
    const jpeg = img.toJPEG(opts.quality ?? 90)
    await writeFile(filepath, jpeg)
  } else {
    await writeFile(filepath, buffer)
  }
}

// ---------------------------------------------------------------------------
// xdg-desktop-portal (Wayland / GNOME)
// ---------------------------------------------------------------------------

async function captureWithXdgPortal(filepath: string, opts: CaptureOptions): Promise<void> {
  const bus = dbus.sessionBus()
  const token = `nulldraft${Date.now()}`

  try {
    const obj = await bus.getProxyObject(
      'org.freedesktop.portal.Desktop',
      '/org/freedesktop/portal/desktop'
    )
    const screenshot = obj.getInterface('org.freedesktop.portal.Screenshot')

    const handlePath = await screenshot.Screenshot('', {
      handle_token: new Variant('s', token),
      interactive: new Variant('b', false),
    })

    const requestObj = await bus.getProxyObject('org.freedesktop.portal.Desktop', handlePath)
    const request = requestObj.getInterface('org.freedesktop.portal.Request')

    const result = await new Promise<{ response: number; results: Record<string, unknown> }>(
      (resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Portal screenshot timed out')), 15000)
        request.on('Response', (response: number, results: Record<string, unknown>) => {
          clearTimeout(timeout)
          resolve({ response, results })
        })
      }
    )

    if (result.response !== 0) {
      throw new Error(`Portal screenshot denied or failed (code ${result.response})`)
    }

    const uriVariant = result.results?.uri as Variant<string> | undefined
    const uri = uriVariant?.value
    if (!uri || typeof uri !== 'string') {
      throw new Error('Portal screenshot returned no file URI')
    }

    const src = decodeURIComponent(uri.replace(/^file:\/\//, ''))

    // If a region crop is requested, crop via nativeImage; otherwise copy.
    if (opts.region || opts.format === 'jpg') {
      const img = nativeImage.createFromPath(src)
      let out = img
      if (opts.region) {
        // The portal image is in physical pixels; region is in DIP, so scale it.
        const sf = screen.getPrimaryDisplay().scaleFactor || 1
        out = img.crop({
          x: Math.round(opts.region.x * sf),
          y: Math.round(opts.region.y * sf),
          width: Math.round(opts.region.width * sf),
          height: Math.round(opts.region.height * sf),
        })
      }
      await writeImage(out.toPNG(), filepath, opts)
    } else {
      await copyFile(src, filepath)
    }
  } finally {
    bus.disconnect()
  }
}

// ---------------------------------------------------------------------------
// Electron desktopCapturer (cross-platform)
// ---------------------------------------------------------------------------

async function captureWithElectron(filepath: string, opts: CaptureOptions): Promise<void> {
  const types: ('screen' | 'window')[] = opts.mode === 'window' ? ['window'] : ['screen']

  // Choose the target display
  let targetDisplay = screen.getPrimaryDisplay()
  if (opts.displayId != null) {
    const found = screen.getAllDisplays().find((d) => d.id === opts.displayId)
    if (found) targetDisplay = found
  }
  const { width, height } = targetDisplay.size
  const scaleFactor = targetDisplay.scaleFactor

  const sources = await desktopCapturer.getSources({
    types,
    thumbnailSize: {
      width: Math.round(width * scaleFactor),
      height: Math.round(height * scaleFactor),
    },
  })

  if (sources.length === 0) {
    throw new Error('No capture sources available from desktopCapturer')
  }

  let source = sources[0]
  if (opts.sourceId) {
    source = sources.find((s) => s.id === opts.sourceId) ?? source
  } else if (opts.mode !== 'window') {
    source = sources.find((s) => s.display_id === String(targetDisplay.id)) ?? source
  }

  let img = source.thumbnail
  if (img.isEmpty()) {
    throw new Error('desktopCapturer returned an empty image')
  }

  if (opts.region) {
    img = img.crop({
      x: Math.round(opts.region.x * scaleFactor),
      y: Math.round(opts.region.y * scaleFactor),
      width: Math.round(opts.region.width * scaleFactor),
      height: Math.round(opts.region.height * scaleFactor),
    })
  }

  await writeImage(img.toPNG(), filepath, opts)
}

// ---------------------------------------------------------------------------
// CLI fallbacks
// ---------------------------------------------------------------------------

async function tryCliCapture(cmd: string, name: string, filepath: string): Promise<boolean> {
  try {
    console.log(`Trying to capture with ${name}...`)
    await execAsync(cmd)
    if (await fileExists(filepath)) {
      console.log(`Success with ${name}`)
      return true
    }
    console.log(`${name} command succeeded but file wasn't created.`)
    return false
  } catch (err) {
    console.log(`${name} failed:`, err instanceof Error ? err.message : String(err))
    return false
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function captureScreenshot(
  filepath: string,
  platform: string,
  options: CaptureOptions = {}
) {
  const opts: CaptureOptions = { mode: 'fullscreen', format: 'png', quality: 90, ...options }

  // Window/region/display modes are handled by Electron's capturer everywhere.
  const needsElectronFirst = opts.mode === 'window' || opts.mode === 'display' ||
    (opts.mode === 'region' && platform !== 'linux')

  const attempts: Array<{ name: string; fn: () => Promise<void> }> = []

  if (needsElectronFirst) {
    attempts.push({ name: 'Electron desktopCapturer', fn: () => captureWithElectron(filepath, opts) })
  }

  if (platform === 'linux') {
    attempts.push({ name: 'xdg-desktop-portal', fn: () => captureWithXdgPortal(filepath, opts) })
    if (!needsElectronFirst) {
      attempts.push({ name: 'Electron desktopCapturer', fn: () => captureWithElectron(filepath, opts) })
    }

    // CLI tools only do full-screen reliably; skip when cropping/window needed.
    if (opts.mode === 'fullscreen') {
      const cliTools = [
        { command: 'gnome-screenshot', cmd: `gnome-screenshot -f "${filepath}"`, name: 'gnome-screenshot' },
        { command: 'grim', cmd: `grim "${filepath}"`, name: 'grim (Wayland)' },
        { command: 'scrot', cmd: `scrot "${filepath}"`, name: 'scrot' },
        { command: 'spectacle', cmd: `spectacle -b -n -o "${filepath}"`, name: 'spectacle' },
        { command: 'import', cmd: `import -window root "${filepath}"`, name: 'imagemagick' },
      ]
      for (const tool of cliTools) {
        if (await commandExists(tool.command)) {
          attempts.push({
            name: tool.name,
            fn: async () => {
              const ok = await tryCliCapture(tool.cmd, tool.name, filepath)
              if (!ok) throw new Error(`${tool.name} did not produce a file`)
            },
          })
        }
      }

      if (await commandExists('xrandr')) {
        attempts.push({
          name: 'screenshot-desktop',
          fn: async () => {
            const { default: screenshot } = await import('screenshot-desktop')
            await screenshot({ filename: filepath })
          },
        })
      }
    }
  } else {
    if (!needsElectronFirst) {
      attempts.push({ name: 'Electron desktopCapturer', fn: () => captureWithElectron(filepath, opts) })
    }
    attempts.push({
      name: 'screenshot-desktop',
      fn: async () => {
        const { default: screenshot } = await import('screenshot-desktop')
        await screenshot({ filename: filepath })
      },
    })
  }

  const errors: string[] = []
  for (const attempt of attempts) {
    try {
      await attempt.fn()
      if (await fileExists(filepath)) {
        return
      }
      errors.push(`${attempt.name}: file was not created`)
    } catch (err) {
      errors.push(`${attempt.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  throw new Error(`Failed to capture screenshot with all available tools.\n${errors.join('\n')}`)
}
