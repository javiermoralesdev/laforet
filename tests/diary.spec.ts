import { test, expect } from '@playwright/test';

// Note: You must have your Vite server and PocketBase running before executing this test.
// Make sure you have a test user created in your database (e.g., test@example.com / password123).

test('Complete Diary Flow: Login, Unlock, Write, and Delete', async ({ page }) => {
    // 1. Navigate to the app
    await page.goto('/');

    // 2. Login Flow
    await page.getByPlaceholder('Email').fill('test@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Login' }).click();

    // 3. Create an Entry
    await page.getByRole('button', { name: 'Write Entry' }).click();

    const uniqueTitle = `E2E Test Entry - ${Date.now()}`;
    await page.getByPlaceholder('Title').fill(uniqueTitle);
    await page.getByPlaceholder('Speak your mind...').fill('This is a highly classified encrypted thought.');

    await page.getByRole('button', { name: 'Save' }).click(); // Matches your "Guardar" submit button

    // 4. Handle the Success Modal
    const modal = page.locator('.modal-content');
    await expect(modal).toContainText('Successfully saved');
    await modal.getByRole('button', { name: 'OK' }).click(); // This triggers your navigate("/")

    // 5. Verify the entry exists on the dashboard
    const newEntry = page.getByRole('link', { name: uniqueTitle });
    await expect(newEntry).toBeVisible();

    // 6. Delete the entry
    // We scope the click to the specific list item containing our test title
    const entryCard = page.locator('li').filter({ hasText: uniqueTitle });

    // Playwright intercepts the window.confirm() dialog you added in EntryView/ListEntries
    page.on('dialog', dialog => dialog.accept());
    await entryCard.getByRole('button', { name: 'Remove' }).click();

    // 7. Handle the Delete Success Modal
    await expect(modal).toContainText('Entry successfully deleted');
    await modal.getByRole('button', { name: 'OK' }).click();

    // 8. Verify it's completely gone
    await expect(newEntry).not.toBeVisible();
});