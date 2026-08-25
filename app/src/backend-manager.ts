import { spawn, spawnSync, ChildProcess } from 'child_process'
import { join } from 'path'
import { existsSync } from 'fs'
import { app } from 'electron'
import http from 'http'

let backendProcess: ChildProcess | null = null
// Port 8000 is commonly used by local development tools, so keep NullDraft's
// backend on an unambiguous port to avoid attaching to an unrelated service.
let backendPort = 8011

const providerKeyEnvironment: Record<string, string> = {
  mistral: 'MISTRAL_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
}

export function getBackendUrl(): string {
  return `http://127.0.0.1:${backendPort}`
}

/**
 * Resolve the backend directory. In dev the repo layout is
 * <root>/app and <root>/backend. In production we look beside resources.
 */
function resolveBackendDir(): string | null {
  const candidates = [
    join(__dirname, '../../../backend'),    // dev: out/main -> app -> root/backend
    join(__dirname, '../../backend'),
    join(process.cwd(), 'backend'),
    join(process.cwd(), '../backend'),
    join(process.resourcesPath || '', 'backend'),
  ]
  for (const c of candidates) {
    if (existsSync(join(c, 'server.py'))) {
      return c
    }
  }
  return null
}

function findExistingVenvPython(backendDir: string): string | null {
  const venvCandidates = [
    join(backendDir, 'venv', 'bin', 'python'),
    join(backendDir, 'venv', 'Scripts', 'python.exe'),
    join(backendDir, '.venv', 'bin', 'python'),
    join(backendDir, '.venv', 'Scripts', 'python.exe'),
  ]
  for (const c of venvCandidates) {
    if (existsSync(c)) return c
  }
  return null
}

function bundledPython(): string | null {
  if (process.platform !== 'win32') return null
  const executable = join(process.resourcesPath || '', 'python', 'python.exe')
  return existsSync(executable) ? executable : null
}

function systemPython(): string {
  return process.platform === 'win32' ? 'python' : 'python3'
}

/**
 * Resolve a Python interpreter with backend deps installed. In dev this is the
 * repo venv. In a packaged app (no bundled venv) we bootstrap a venv inside
 * userData and pip-install requirements on first launch.
 */
function ensurePythonBin(backendDir: string): string {
  const bundled = bundledPython()
  if (bundled) return bundled

  const existing = findExistingVenvPython(backendDir)
  if (existing) return existing

  // Production: create a venv in a writable location and install requirements.
  const venvDir = join(app.getPath('userData'), 'py-venv')
  const venvPython = process.platform === 'win32'
    ? join(venvDir, 'Scripts', 'python.exe')
    : join(venvDir, 'bin', 'python')

  if (existsSync(venvPython)) return venvPython

  try {
    console.log('[backend] Bootstrapping Python venv at', venvDir)
    spawnSync(systemPython(), ['-m', 'venv', venvDir], { stdio: 'inherit' })
    const reqs = join(backendDir, 'requirements.txt')
    if (existsSync(venvPython) && existsSync(reqs)) {
      console.log('[backend] Installing backend requirements (first launch, may take a while)')
      spawnSync(venvPython, ['-m', 'pip', 'install', '-q', '-r', reqs], { stdio: 'inherit' })
    }
  } catch (e) {
    console.error('[backend] venv bootstrap failed:', e)
  }

  return existsSync(venvPython) ? venvPython : systemPython()
}

function ping(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`${url}/health`, (res) => {
      res.resume()
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(1500, () => {
      req.destroy()
      resolve(false)
    })
  })
}

export async function waitForBackend(timeoutMs = 20000): Promise<boolean> {
  const url = getBackendUrl()
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await ping(url)) return true
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

/**
 * Start the Python backend. Passes the configured API key and provider via env.
 * If a backend is already responding on the port, reuse it.
 */
export async function startBackend(options: {
  apiKey?: string
  provider?: string
  port?: number
} = {}): Promise<{ started: boolean; reused: boolean; error?: string }> {
  if (options.port) backendPort = options.port

  // Reuse an already-running backend (e.g. started manually in dev).
  if (await ping(getBackendUrl())) {
    console.log('[backend] Reusing existing backend on', getBackendUrl())
    return { started: true, reused: true }
  }

  const backendDir = resolveBackendDir()
  if (!backendDir) {
    console.error('[backend] Could not locate backend directory')
    return { started: false, reused: false, error: 'backend directory not found' }
  }

  const python = ensurePythonBin(backendDir)
  const serverPath = join(backendDir, 'server.py')
  console.log('[backend] Starting:', python, serverPath)

  const env: NodeJS.ProcessEnv = { ...process.env, NULLDRAFT_PORT: String(backendPort) }
  const provider = (options.provider || 'mistral').toLowerCase()
  if (options.apiKey) env[providerKeyEnvironment[provider] || 'MISTRAL_API_KEY'] = options.apiKey
  env.AI_PROVIDER = provider

  try {
    // The embedded Windows Python distribution runs in isolated mode, so it
    // does not add the script folder to sys.path by itself. Start server.py
    // through runpy after adding the bundled backend directory explicitly.
    const launcher = [
      'import runpy, sys',
      `sys.path.insert(0, ${JSON.stringify(backendDir)})`,
      `runpy.run_path(${JSON.stringify(serverPath)}, run_name='__main__')`,
    ].join('; ')
    backendProcess = spawn(python, ['-c', launcher], {
      cwd: backendDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    backendProcess.stdout?.on('data', (d) => console.log('[backend]', d.toString().trim()))
    backendProcess.stderr?.on('data', (d) => console.log('[backend]', d.toString().trim()))
    backendProcess.on('exit', (code) => {
      console.log('[backend] exited with code', code)
      backendProcess = null
    })

    const ok = await waitForBackend()
    return { started: ok, reused: false, error: ok ? undefined : 'backend did not become healthy' }
  } catch (e) {
    console.error('[backend] Failed to spawn:', e)
    return { started: false, reused: false, error: String(e) }
  }
}

export function stopBackend() {
  if (backendProcess) {
    console.log('[backend] Stopping backend process')
    try {
      backendProcess.kill()
    } catch (e) {
      console.error('[backend] Failed to kill:', e)
    }
    backendProcess = null
  }
}

export async function getBackendHealth(): Promise<any> {
  return new Promise((resolve) => {
    const req = http.get(`${getBackendUrl()}/health`, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch {
          resolve(null)
        }
      })
    })
    req.on('error', () => resolve(null))
    req.setTimeout(2000, () => {
      req.destroy()
      resolve(null)
    })
  })
}

// Ensure backend is killed when the app quits.
app.on('before-quit', stopBackend)
app.on('will-quit', stopBackend)
