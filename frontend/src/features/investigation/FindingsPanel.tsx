import { useLanguage } from '../../lib/language';
import { Icon } from "../../components/Icon";
import type { Finding } from "../../lib/api/types.ts";
import type { LoadState } from "./state.ts";

import { FindingStatus } from "./FindingStatus";
export { statusLabels } from "./FindingStatus";

interface FindingsPanelProps {
  findings: Finding[];
  onSelectFinding: (id: string) => void;
  selectedFindingId?: string | null;
  state?: LoadState;
}

export function FindingsPanel({
  findings,
  onSelectFinding,
  selectedFindingId,
  state,
}: FindingsPanelProps) {
  const { t } = useLanguage();
  let content;
  if (state?.status === "idle") {
    content = <p>{t("Choose a scenario to see findings.")}</p>;
  } else if (state?.status === "loading") {
    content = <p role="status">{t("Analyzing scenario…")}</p>;
  } else if (state?.status === "error") {
    content = <p role="alert">{state.message}</p>;
  } else if (findings.length === 0) {
    content = <p>{t("No findings in the available events.")}</p>;
  } else {
    content = (
      <ul className="tg-finding-list">
        {findings.map((finding) => (
          <li key={finding.id}>
            <button
              type="button"
              aria-pressed={selectedFindingId === finding.id}
              onClick={() => onSelectFinding(finding.id)}
            >
              <FindingStatus status={finding.status} />
              <span>{t(finding.message)}</span>
              <code>{finding.rule_id}</code>
            </button>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <section className="tg-investigation-panel" aria-label={t("Findings")}>
      <header className="panel-heading"><h2><Icon name="finding" />{t("Finding details")}</h2><span>{findings.length} {findings.length === 1 ? t("finding") : t("findings")}</span></header>
      {content}
    </section>
  );
}
