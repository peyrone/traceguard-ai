export type CaseSection = 'workspace' | 'report' | 'references';

export function caseHref(section: CaseSection, caseId: string) {
  return '#' + section + '?' + new URLSearchParams({ case: caseId });
}

export function readRoute(): { section: 'dashboard' } | { section: CaseSection; caseId: string } {
  const [section, search] = window.location.hash.slice(1).split('?');
  const caseId = new URLSearchParams(search).get('case');
  if (caseId && (section === 'workspace' || section === 'report' || section === 'references')) {
    return { section, caseId };
  }
  return { section: 'dashboard' };
}
