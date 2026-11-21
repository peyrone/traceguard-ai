import { useId } from 'react';
import type { Graph } from '../../lib/api/types';

export function LinkComposition({ edges }: { edges: Graph['edges'] }) {
  const captionId = useId();
  const observed = edges.filter(edge => edge.evidence_status === 'OBSERVED').length;
  const inferred = edges.length - observed;
  return <figure className="link-composition" aria-labelledby={captionId}>
    <figcaption id={captionId}>Link evidence</figcaption>
    <div className="composition-meter" aria-hidden="true">
      {observed > 0 && <span className="observed-fill" style={{ flexGrow: observed }} />}
      {inferred > 0 && <span className="inferred-fill" style={{ flexGrow: inferred }} />}
    </div>
    <div className="composition-key">
      <span><i className="observed-key" aria-hidden="true"/>Observed <b>{observed}</b></span>
      <span><i className="inferred-key" aria-hidden="true"/>Inferred <b>{inferred}</b></span>
    </div>
  </figure>;
}
