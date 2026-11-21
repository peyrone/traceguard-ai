import { useLanguage } from '../../lib/language';
import type { GraphEdge } from '../../lib/api/types';
import { Icon } from '../../components/Icon';

export function ServiceRoute({ edge, labels }: { edge: GraphEdge; labels: Map<string, string> }) {
  const { t } = useLanguage();
  const observed = edge.evidence_status === 'OBSERVED';
  return <div className="service-route">
    <span className="route-endpoints">
      <span className="route-stop">{labels.get(edge.source) ?? edge.source}</span>
      <span aria-hidden="true"><Icon name="route" size={16} /></span>
      <span className="sr-only"> → </span><span className="route-stop">{labels.get(edge.target) ?? edge.target}</span>
    </span>
    <span className="route-type" data-inferred={!observed}>
      {observed ? t("Observed transfer") : t("Inferred link")}
    </span>
  </div>;
}
