import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";

const waitForShell = async (page: Page) => {
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator(".agent-shell")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".agent-bubble-host .agent-bubble")).toBeVisible({ timeout: 15_000 });
};

const resolveFirstWindow = async (app: ElectronApplication) => {
  try {
    return await app.firstWindow();
  } catch {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const windows = app.windows();
      if (windows.length > 0) {
        return windows[0]!;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("Electron window did not become available.");
  }
};

const launchOverlayApp = async (prefix: string) => {
  const mainEntry = join(process.cwd(), "out", "main", "index.js");
  const userDataDir = mkdtempSync(join(tmpdir(), prefix));

  const launch = async () =>
    electron.launch({
      args: [mainEntry],
      env: {
        ...process.env,
        XG5000_USER_DATA_DIR: userDataDir,
      },
    });

  let app = await launch();
  try {
    const page = await resolveFirstWindow(app);
    await waitForShell(page);
    return { app, page, userDataDir };
  } catch {
    await app.close().catch(() => undefined);
    app = await launch();
    const page = await resolveFirstWindow(app);
    await waitForShell(page);
    return { app, page, userDataDir };
  }
};

test("버블 클릭 시 단일 에이전트 패널이 열린다", async () => {
  const mainEntry = join(process.cwd(), "out", "main", "index.js");
  test.skip(!existsSync(mainEntry), "E2E 실행 전 `npm run build`가 필요합니다.");

  const { app, page, userDataDir } = await launchOverlayApp("xg5000-e2e-open-");

  try {
    const bubbleButton = page.locator(".agent-bubble-host .agent-bubble");
    await bubbleButton.click({ force: true });

    await expect(page.locator(".agent-shell")).toHaveClass(/agent-shell--panel-open/, { timeout: 15_000 });
    await expect(page.locator(".agent-panel-host")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-agent-surface="panel-host"]')).toHaveCount(1);
    await expect(page.locator(".agent-bubble-host")).toHaveCount(0);
    await expect(page.locator(".agent-panel__hero")).toBeVisible();
    await expect(page.locator("#agent-question")).toBeVisible();
    await expect(page.locator('[data-agent-section="approval"]')).toBeVisible();
    await expect(page.locator('[data-agent-section="evidence"]')).toBeVisible();
  } finally {
    await app.close();
    rmSync(userDataDir, { recursive: true, force: true });
  }
});

test("시작 시 bubble-only 상태를 유지한다", async () => {
  const mainEntry = join(process.cwd(), "out", "main", "index.js");
  test.skip(!existsSync(mainEntry), "E2E 실행 전 `npm run build`가 필요합니다.");

  const { app, page, userDataDir } = await launchOverlayApp("xg5000-e2e-bubble-");

  try {
    await expect(page.locator(".agent-shell")).toHaveClass(/agent-shell--bubble-only/);
    await expect(page.locator(".agent-bubble-host .agent-bubble")).toBeVisible();
    await expect(page.locator(".agent-panel-host")).toHaveCount(0);
    await expect(page.locator('[data-agent-surface="panel-host"]')).toHaveCount(0);
  } finally {
    await app.close();
    rmSync(userDataDir, { recursive: true, force: true });
  }
});
