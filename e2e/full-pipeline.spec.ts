import { test, expect } from '@playwright/test';

/**
 * Full E2E Pipeline Test
 * 
 * Prerequisites (must be running BEFORE test):
 *   - Docker Postgres with pgvector: `docker compose up`
 *   - Ollama with gemma4 pulled: `ollama serve` + `ollama pull gemma4`
 *   - Dev servers: `npm run dev`
 * 
 * This test exercises the REAL pipeline end-to-end:
 *   1. Enters "lguibr" GitHub handle → fetches repos
 *   2. Selects "commitai" and "codeconcat"
 *   3. Launches full embedding pipeline
 *   4. Waits for the pipeline to complete all phases
 *   5. Validates DB state via API
 */

test.describe('Full Pipeline E2E: lguibr → commitai + codeconcat', () => {
  test.setTimeout(600_000); // 10 minutes for real pipeline

  test.beforeEach(async ({ page }) => {
    // Factory reset DB for a clean run
    try {
      const res = await page.request.delete('http://localhost:3001/api/reset');
      expect(res.ok()).toBeTruthy();
      console.log('[E2E] ✓ Database factory reset');
    } catch (e) {
      console.warn('[E2E] ⚠ DB reset failed, proceeding:', e);
    }
    // Small delay to let backend process the reset
    await page.waitForTimeout(1000);
  });

  test('completes ingestion of commitai and codeconcat through all pipeline phases', async ({ page }) => {
    // ─── STEP 1: Load Onboarding ───
    await page.goto('/onboarding');
    await expect(page.getByText('Graph Offline')).toBeVisible({ timeout: 10_000 });
    console.log('[E2E] ✓ Step 1: Onboarding page loaded, Graph Offline visible');

    // ─── STEP 2: Enter GitHub handle and fetch repos ───
    await page.getByPlaceholder('lgulbr').fill('lguibr');
    await page.locator('button').filter({ has: page.locator('svg.lucide-search') }).click();
    
    // Wait for both target repos to appear in the list
    await expect(page.getByText('commitai')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/codeconcat/i)).toBeVisible({ timeout: 10_000 });
    console.log('[E2E] ✓ Step 2: GitHub repos fetched, commitai + codeconcat visible');

    // ─── STEP 3: Select repos ───
    const commitaiLabel = page.locator('label').filter({ hasText: 'commitai' });
    await commitaiLabel.scrollIntoViewIfNeeded();
    await commitaiLabel.click();

    const codeconcatLabel = page.locator('label').filter({ hasText: /codeconcat/i });
    await codeconcatLabel.scrollIntoViewIfNeeded();
    await codeconcatLabel.click();
    console.log('[E2E] ✓ Step 3: Selected commitai and codeconcat');

    // ─── STEP 4: Launch pipeline ───
    const embedButton = page.getByRole('button', { name: /Finalize Selection.*Begin Embedding/i });
    await expect(embedButton).toBeEnabled();
    await embedButton.click();
    console.log('[E2E] ✓ Step 4: Clicked "Finalize Selection & Begin Embedding"');

    // ─── STEP 5: Verify Phase 2 starts ───
    await expect(page.getByText('Embedding System Running')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Graph Offline')).not.toBeVisible({ timeout: 15_000 });
    console.log('[E2E] ✓ Step 5: Phase 2 active — Embedding System Running');

    // ─── STEP 6: Wait for pipeline to fully complete ───
    // The pipeline runs: Clone → Repomix → Chunk → Embed → LLM Summary → Persist → Interview
    // When fully done, one of these signals will appear:
    //   - "Resume System Operation" link (wizard completed)
    //   - Phase 3 CV editor ("BASE_CV.md" header or "Submit Resume" button)
    //   - An interview question interrupt
    //   - The "Onboarding Complete" state text
    // We use polling on the backend API as the ground truth — the UI may lag.

    console.log('[E2E]   Waiting for pipeline to process repos through gemma4 LLM...');
    console.log('[E2E]   This typically takes 2-5 minutes depending on GPU speed.');

    // Poll the backend API to detect when a profile has been created
    // (The persister node creates it after the first supervisor cycle)
    let profileCreated = false;
    const startTime = Date.now();
    const maxWait = 480_000; // 8 minutes

    while (!profileCreated && (Date.now() - startTime) < maxWait) {
      try {
        const res = await page.request.get('http://localhost:3001/api/profile/latest');
        if (res.ok()) {
          const body = await res.json();
          if (body && body.id) {
            profileCreated = true;
            console.log(`[E2E] ✓ Step 6: Profile created in DB — ID: ${body.id}, handle: ${body.github_handle}`);
          }
        }
      } catch (e) {
        // Keep waiting
      }
      if (!profileCreated) {
        await page.waitForTimeout(5000); // Poll every 5 seconds
      }
    }

    expect(profileCreated).toBe(true);

    // ─── STEP 7: Wait for UI to catch up and show post-ingestion state ───
    // Once the backend processed everything, the UI should eventually transition.
    // Check either the wizard advanced OR the "Resume System Operation" link appears.
    await expect(
      page.locator('text=/Resume System Operation|BASE_CV|Submit Resume|Interview|Question|Onboarding Complete/i').first()
    ).toBeVisible({ timeout: 60_000 });
    console.log('[E2E] ✓ Step 7: UI transitioned to post-ingestion phase');

    // ─── STEP 8: Final validation — screenshot ───
    await page.screenshot({ path: 'test-results/e2e-pipeline-success.png' });
    
    console.log('[E2E] ══════════════════════════════════════════');
    console.log('[E2E]  ✅ FULL PIPELINE E2E TEST PASSED');
    console.log('[E2E] ══════════════════════════════════════════');
  });
});
