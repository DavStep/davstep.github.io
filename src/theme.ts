type Appearance = 'system' | 'light' | 'dark';
const root = document.documentElement;
const control = document.querySelector<HTMLSelectElement>('#theme-select')!;
const browserLight = window.matchMedia?.('(prefers-color-scheme: light)');
const browserDark = window.matchMedia?.('(prefers-color-scheme: dark)');
let preference: Appearance = root.dataset.themePreference === 'light' || root.dataset.themePreference === 'dark'
  ? root.dataset.themePreference : 'system';

function applyAppearance() {
  const theme = preference === 'system' ? (browserLight?.matches ? 'light' : 'dark') : preference;
  root.dataset.theme = theme;
  root.dataset.themePreference = preference;
  root.style.colorScheme = theme;
  control.value = preference;
  control.parentElement!.title = `Appearance: ${preference === 'system' ? `System (${theme})` : theme}`;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!.content = theme === 'light' ? '#eee8da' : '#202020';
}

control.addEventListener('change', () => {
  preference = control.value as Appearance;
  try {
    if (preference === 'system') localStorage.removeItem('davstep.appearance');
    else localStorage.setItem('davstep.appearance', preference);
  } catch { /* Appearance still works when the browser blocks storage. */ }
  applyAppearance();
});
browserLight?.addEventListener('change', applyAppearance);
browserDark?.addEventListener('change', applyAppearance);
window.addEventListener('storage', event => {
  if (event.key !== 'davstep.appearance' && event.key !== null) return;
  preference = event.newValue === 'light' || event.newValue === 'dark' ? event.newValue : 'system';
  applyAppearance();
});
applyAppearance();
