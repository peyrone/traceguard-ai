import { useEffect, useState } from 'react';
import logo from './assets/team-logo.webp';

export function WorkspaceHeader({ hasReferences }: { hasReferences: boolean }) {
  const [dark, setDark] = useState(document.documentElement.dataset.theme === 'dark');
  const [section, setSection] = useState(window.location.hash);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    function followSystem() {
      if (!document.documentElement.dataset.preference) setDark(Boolean(media?.matches));
    }
    function readHash() { setSection(window.location.hash); }
    followSystem();
    media?.addEventListener('change', followSystem);
    window.addEventListener('hashchange', readHash);
    return () => {
      media?.removeEventListener('change', followSystem);
      window.removeEventListener('hashchange', readHash);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);

  function toggle() {
    const theme = dark ? 'light' : 'dark';
    document.documentElement.dataset.preference = theme;
    try { localStorage.setItem('traceguard-theme', theme); } catch { /* Use the tab preference. */ }
    setDark(!dark);
  }

  const atReferences = hasReferences && section === '#references';
  return <header className="topbar"><div className="nav-inner">
    <a className="brand" href="#workspace" aria-label="TraceGuard AI workspace">
      <span className="brand-mark"><img src={logo} alt="" /></span>TraceGuard <b>AI</b>
    </a>
    <nav aria-label="Main navigation">
      <a href="#workspace" aria-current={atReferences ? undefined : 'location'}>Workspace</a>
      {hasReferences && <a href="#references" aria-current={atReferences ? 'location' : undefined}>Evidence references</a>}
    </nav>
    <span className="data-source">Synthetic audit data · API mode</span>
    <button className="theme-toggle" type="button" onClick={toggle} aria-label="Dark mode" aria-pressed={dark}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        {dark ? <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>
          : <path d="M20.5 14.1A8.7 8.7 0 0 1 9.9 3.5a8.8 8.8 0 1 0 10.6 10.6Z"/>}
      </svg>
    </button>
  </div></header>;
}
