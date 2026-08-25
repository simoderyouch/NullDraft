import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

test('launches the desktop app and creates a project through review', async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), 'nulldraft-e2e-'))
  const app = await electron.launch({
    args: ['.', '--no-sandbox'],
    env: {
      ...process.env,
      ELECTRON_DISABLE_SANDBOX: '1',
      NULLDRAFT_USER_DATA_DIR: userDataDir,
      // Exercise the packaged file:// renderer instead of relying on a dev server.
      VITE_DEV_SERVER_URL: pathToFileURL(join(process.cwd(), 'out/renderer/index.html')).toString(),
    },
  })

  try {
    // Electron creates the floating HUD as well as the main workspace. The HUD
    // can win the first-window race, so deliberately select the non-HUD page.
    await expect.poll(() => app.windows().filter((window) => !window.url().includes('#/hud')).length).toBe(1)
    const page = app.windows().find((window) => !window.url().includes('#/hud'))
    if (!page) throw new Error('Main NullDraft window was not created')
    const rendererErrors: string[] = []
    page.on('pageerror', (error) => rendererErrors.push(error.message))
    await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible()

    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(page).toHaveURL(/\/settings/)
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    expect(rendererErrors).toEqual([])
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible()

    await page.getByRole('button', { name: 'New Project' }).click()
    await expect(page.getByRole('heading', { name: 'New Project' })).toBeVisible()

    await page.getByLabel('Project Name').fill('E2E Docker Workflow')
    await page.getByPlaceholder('e.g. Open Terminal').fill('Check Docker version')
    await page.getByPlaceholder('e.g. Terminal output after successful installation').fill('Docker version output')
    await page.getByPlaceholder(/Explain what should be visible/).fill(
      'Run docker --version, then capture the terminal output showing the installed Docker version.'
    )

    await page.getByRole('button', { name: 'Review' }).click()
    await expect(page).toHaveURL(/\/review/)
    await expect(page.getByRole('heading', { name: 'Review Steps' })).toBeVisible()
    await expect(page.getByText('Check Docker version')).toBeVisible()

    await page.getByRole('button', { name: 'Edit Steps' }).click()
    await expect(page.getByRole('heading', { name: 'New Project' })).toBeVisible()
    await page.locator('input[type="file"]').setInputFiles(join(process.cwd(), 'e2e/fixtures/docker-assignment.txt'))

    await expect(page.getByText('Steps generated')).toHaveCount(1)
    await expect(page.getByPlaceholder('e.g. Open Terminal').first()).toHaveValue(/Install Docker/)
    await expect(page.getByPlaceholder(/Explain what should be visible/).first()).toHaveValue(/screenshot|capture/i)
    await expect(page.getByPlaceholder('e.g. Open Terminal')).toHaveCount(3)
  } finally {
    await app.close()
    await rm(userDataDir, { recursive: true, force: true })
  }
})
