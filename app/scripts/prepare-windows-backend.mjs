import { createWriteStream, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PYTHON_VERSION = '3.12.10'
const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectDir = resolve(appDir, '..')
const runtimeDir = join(appDir, 'build', 'python-win')
const sitePackagesDir = join(runtimeDir, 'Lib', 'site-packages')
const archivePath = join(appDir, 'build', `python-${PYTHON_VERSION}-embed-amd64.zip`)
const archiveUrl = `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`
const requirementsPath = join(projectDir, 'backend', 'requirements.txt')

async function download(url, destination) {
  const response = await fetch(url)
  if (!response.ok || !response.body) throw new Error(`Could not download ${url} (${response.status})`)
  const output = createWriteStream(destination)
  await pipeline(Readable.fromWeb(response.body), output)
}

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit' })
}

mkdirSync(join(appDir, 'build'), { recursive: true })
rmSync(runtimeDir, { recursive: true, force: true })
mkdirSync(runtimeDir, { recursive: true })

if (!existsSync(archivePath)) {
  console.log(`Downloading embedded Python ${PYTHON_VERSION} for Windows x64…`)
  await download(archiveUrl, archivePath)
}

console.log('Extracting embedded Python…')
run('unzip', ['-q', archivePath, '-d', runtimeDir])

const pthPath = join(runtimeDir, 'python312._pth')
// The embedded distribution runs in isolated mode. The launcher adds the
// application backend folder explicitly; this file only exposes bundled deps.
writeFileSync(pthPath, 'python312.zip\n.\nLib/site-packages\nimport site\n', 'utf8')
mkdirSync(sitePackagesDir, { recursive: true })

console.log('Installing Windows backend wheels into the embedded runtime…')
run('python3', [
  '-m', 'pip', 'install', '--no-compile', '--only-binary=:all:', '--platform', 'win_amd64',
  '--python-version', '3.12', '--implementation', 'cp', '--abi', 'cp312',
  '--target', sitePackagesDir, '-r', requirementsPath,
])

writeFileSync(join(runtimeDir, 'nulldraft-runtime.json'), JSON.stringify({ python: PYTHON_VERSION }, null, 2))
console.log(`Bundled Python runtime ready: ${runtimeDir}`)
