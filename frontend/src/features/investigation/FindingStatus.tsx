import { useLanguage } from '../../lib/language';
import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import type { AnalysisStatus } from "../../lib/api/types";

export const statusLabels: Record<AnalysisStatus, string> = {
  VERIFIED_VIOLATION: "Verified violation",
  POTENTIAL_VIOLATION: "Potential violation",
  INCONCLUSIVE: "Inconclusive",
  NO_VIOLATION_OBSERVED: "No violation observed",
};

function IssueIcon({ name }: { name: "violation" | "warning" }) {
  const marker = useRef<HTMLSpanElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (!marker.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setSeen(true);
        observer.disconnect();
      }
    }, { threshold: 0.5 });
    observer.observe(marker.current);
    return () => observer.disconnect();
  }, []);

  return <span ref={marker} className="finding-issue-icon" data-seen={seen} aria-hidden="true">
    <Icon name={name} size={16} />
  </span>;
}

export function FindingStatus({ status }: { status: AnalysisStatus }) {
  const { t } = useLanguage();
  return <strong className="finding-status" data-status={status}>
    {(status === "VERIFIED_VIOLATION" || status === "POTENTIAL_VIOLATION") &&
      <IssueIcon key={status} name={status === "VERIFIED_VIOLATION" ? "violation" : "warning"} />}
    {t(statusLabels[status])}
  </strong>;
}
