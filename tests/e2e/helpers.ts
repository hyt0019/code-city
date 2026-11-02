import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** The page title comes from the profile settings in the generated display config. */
export const profileTitle: string = JSON.parse(readFileSync('generated/display.json', 'utf8'))
  .profile.title;

/** The built-in demo uses its own title rather than the owner's. */
export const demoTitle = 'Code City demo';

/** The chip that focuses the city on one repository; an empty name means "All". */
export function repositoryChip(page: Page, name: string) {
  return page
    .getByRole('group', { name: 'Filter repository' })
    .getByRole('button', { name: name || 'All repositories', exact: true });
}

/** Focus a repository, or show all of them. Choosing the focused one again keeps it. */
export async function chooseRepository(page: Page, name: string) {
  const chip = repositoryChip(page, name);
  if ((await chip.getAttribute('aria-pressed')) !== 'true') await chip.click();
  await expectRepository(page, name);
}

export async function expectRepository(page: Page, name: string) {
  await expect(repositoryChip(page, name)).toHaveAttribute('aria-pressed', 'true');
}
