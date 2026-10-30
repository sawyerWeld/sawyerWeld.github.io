import { loadLeagueFeed } from '../league-feed.mjs?v=d6ea6427d4b5';
import { validateData } from '../combined/data-source.mjs?v=d6ea6427d4b5';

export const element = (id) => document.getElementById(id);

export function escapeHtml(value) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);
}

export function formatDate(value, includeYear = false) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
}

export async function loadLeagueData() {
  const feed = await loadLeagueFeed();
  return validateData(feed.combined);
}

export async function loadDeckImages() {
  return (await loadLeagueFeed()).images;
}
