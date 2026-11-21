import { useLanguage } from '../../lib/language';
import type { Scenario } from "../../lib/api/types.ts";
import type { LoadState } from "./state.ts";
import "./investigation.css";

interface ScenarioSelectorProps {
  scenarios: Scenario[];
  onChange: (scenarioId: string) => void;
  selectedScenarioId?: string;
  state?: LoadState;
}

export function ScenarioSelector({
  scenarios,
  onChange,
  selectedScenarioId,
  state,
}: ScenarioSelectorProps) {
  const { t } = useLanguage();
  const unavailable = state?.status === "loading" || state?.status === "error";
  return (
    <div className="tg-scenario">
      <label>{t("Scenario")}<select
          value={selectedScenarioId}
          defaultValue={selectedScenarioId === undefined ? "" : undefined}
          disabled={unavailable || scenarios.length === 0}
          onChange={(event) => onChange(event.currentTarget.value)}
        >
          <option value="" disabled>{t("Choose a scenario")}</option>
          {scenarios.map(({ id, label }) => <option key={id} value={id}>{t(label)}</option>)}
        </select>
      </label>
      {state?.status === "loading" && <p role="status">{t("Loading scenarios…")}</p>}
      {state?.status === "error" && <p role="alert">{state.message}</p>}
      {!unavailable && scenarios.length === 0 && <p>{t("No scenarios available.")}</p>}
    </div>
  );
}
