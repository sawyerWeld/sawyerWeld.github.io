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
  // Published pages declare their feed URL; local previews use the adjacent snapshot.
  const url = document.querySelector('meta[name="league-data"]')?.content || './data.json';
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw Error('Could not load league data.');
  return response.json();
}
