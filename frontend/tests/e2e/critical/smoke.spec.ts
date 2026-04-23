import { test, expect } from '@playwright/test'

test.describe('Smoke @critical', () => {
  test('rota / sem sessão redireciona para /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('página /login carrega e mostra formulário', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Assinatura de Contrato', { exact: true })).toBeVisible()
    await expect(page.getByLabel('E-mail')).toBeVisible()
    await expect(page.getByLabel('Senha')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
  })

  test('login com credencial inválida mostra erro', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill('ninguem@lancio.com.br')
    await page.getByLabel('Senha').fill('senha-errada-123')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByText(/e-mail ou senha incorretos/i)).toBeVisible({ timeout: 10_000 })
    await expect(page).toHaveURL(/\/login$/)
  })
})
