import { useState } from 'react';
import { Download, Upload, ShieldCheck, Check } from 'lucide-react';
import { api } from '../hooks/api';
import { importRules, exportRules, defaultRules, isBlocked } from '../filtering/engine';
import type { FilterRule, Settings, Snapshot } from '../shared/types';
import { Toggle } from './Toggle';
export function FilteringSettings({
  snapshot,
  patch,
  onRefresh,
  onNotice,
}: {
  snapshot: Snapshot;
  patch: (patch: Partial<Settings>) => void;
  onRefresh: () => Promise<void>;
  onNotice: (message: string) => void;
}) {
  const [rulesText, setRulesText] = useState(exportRules(snapshot.rules)),
    [ruleError, setRuleError] = useState('');
  const settings = snapshot.settings;
  async function saveRules(rules: FilterRule[]) {
    try {
      await api({ op: 'rules', rules });
      await onRefresh();
      setRuleError('');
      onNotice('Filter rules saved.');
    } catch (e) {
      setRuleError((e as Error).message);
    }
  }
  return (
    <section className="settings-section" id="settings-filtering">
      <h2>
        <ShieldCheck size={20} /> Ad & content filtering
      </h2>
      <Toggle
        label="Ad & Content Filtering"
        description="Filter promotional elements rendered by Luma."
        value={settings.filtering}
        onChange={(filtering) => patch({ filtering })}
      />
      <Toggle
        label="Advanced filtering"
        description="Also match text, domains, and wildcard patterns in app content."
        value={settings.advancedFiltering}
        onChange={(advancedFiltering) => patch({ advancedFiltering })}
      />
      <div className="notice">
        These rules apply only to Luma’s interface. The official YouTube player, its advertising,
        and its protections are never modified.
      </div>
      <details className="filter-editor">
        <summary>
          Manage filters <span>{snapshot.rules.length} rules</span>
        </summary>
        <p>
          Import or edit JSON rules. Actions: block / allow. Types: text, domain, pattern, cosmetic.
          Allow rules take priority. Patterns use * and ? wildcards. Cosmetic rules only accept
          app-owned promotion categories.
        </p>
        <textarea
          aria-label="Filter rules JSON"
          spellCheck={false}
          rows={12}
          value={rulesText}
          onChange={(e) => setRulesText(e.target.value)}
        />
        {ruleError && (
          <p className="error-text" role="alert">
            {ruleError}
          </p>
        )}
        <div className="button-row">
          <button
            className="primary"
            onClick={() => {
              try {
                void saveRules(importRules(rulesText));
              } catch (e) {
                setRuleError((e as Error).message);
              }
            }}
          >
            <Check size={15} /> Save rules
          </button>
          <label className="button file-button">
            <Upload size={15} /> Import
            <input
              aria-label="Import filter rules"
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 250000)
                    throw new Error('Filter file is too large (250 KB maximum).');
                  const rules = importRules(await file.text());
                  setRulesText(exportRules(rules));
                  setRuleError('');
                } catch (error) {
                  setRuleError((error as Error).message);
                }
                e.target.value = '';
              }}
            />
          </label>
          <button
            onClick={() => {
              const blob = new Blob([exportRules(snapshot.rules)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'luma-filters.json';
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            <Download size={15} /> Export saved rules
          </button>
          <button onClick={() => setRulesText(exportRules(defaultRules))}>Load defaults</button>
        </div>
        <div className="filter-preview">
          <span className="eyebrow">FILTER PREVIEW</span>
          {isBlocked(
            { text: 'Example sponsored card', promotion: 'sponsored' },
            snapshot.rules,
            settings.filtering,
            settings.advancedFiltering,
          ) ? (
            <p>
              <ShieldCheck size={16} /> Sample sponsored card is hidden by your rules.
            </p>
          ) : (
            <div data-promotion="sponsored" className="sample-promotion">
              Example sponsored card · filter demonstration only
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
