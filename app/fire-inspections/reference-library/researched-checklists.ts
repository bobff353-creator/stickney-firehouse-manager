import rawResearch from './researched-checklists.data.json';

export type ResearchSourceType = 'forum lead' | 'official checklist' | 'Illinois authority';
export type ResearchSource = {
  id: string;
  title: string;
  url: string;
  type: ResearchSourceType;
};
export type ResearchQuestion = {
  id: string;
  title: string;
  category: string;
  condition?: string;
  guidance: string;
  sourceIds: string[];
};
export type ChecklistResearchProfile = {
  occupancy: string;
  overview: string;
  authorityGate?: string;
  questions: ResearchQuestion[];
};
export type ChecklistSystemModule = {
  id: string;
  label: string;
  systemKeys?: string[];
  questions: ResearchQuestion[];
};
type ChecklistResearch = {
  checkedOn: string;
  caveat: string;
  sources: ResearchSource[];
  sharedCore: ResearchQuestion[];
  profiles: ChecklistResearchProfile[];
  conditionalModules: ChecklistSystemModule[];
};
export type ResearchedChecklistItem = ResearchQuestion & {
  reference: string;
  sourceUrl: string;
  verified: false;
  researchSources: ResearchSource[];
  researchCheckedOn: string;
  researchOrigin: 'shared' | 'occupancy' | 'system';
  researchModuleId?: string;
  researchModuleLabel?: string;
};

function sourceType(value: string): ResearchSourceType {
  if (value === 'forum lead' || value === 'official checklist' || value === 'Illinois authority') return value;
  throw new Error('Unknown checklist research source type: ' + value);
}

// The checked-in JSON is original research data, validated before inclusion.
// No source in this file establishes an approved code citation.
const research: ChecklistResearch = {
  ...rawResearch,
  sources: rawResearch.sources.map(source => ({...source, type: sourceType(source.type)})),
};
const normalize = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, ' ') : '';
const profileByName = new Map(research.profiles.map(profile => [normalize(profile.occupancy), profile]));
const sourceById = new Map(research.sources.map(source => [source.id, source]));
const fallbackProfile = profileByName.get('mixed use')!;
const municipalCodeUrl = 'https://library.municode.com/il/stickney/codes/code_of_ordinances';

export const CHECKLIST_RESEARCH_CHECKED_ON = research.checkedOn;
export const CHECKLIST_RESEARCH_CAVEAT = research.caveat;
export const CHECKLIST_RESEARCH_SOURCES: readonly ResearchSource[] = research.sources;
export const CHECKLIST_SYSTEM_MODULES: readonly ChecklistSystemModule[] = research.conditionalModules;

/** Friendly planning profile only; it does not assign a legal occupancy group. */
export function getChecklistProfile(occupancy: string): ChecklistResearchProfile {
  return profileByName.get(normalize(occupancy)) ?? fallbackProfile;
}

/** Installed features select prompts; they do not prove a system is required or compliant. */
export function getChecklistModules(systems: readonly string[] = []): ChecklistSystemModule[] {
  const selected = new Set((Array.isArray(systems) ? systems : []).map(normalize));
  return research.conditionalModules.filter(module => module.systemKeys?.some(key => selected.has(normalize(key))));
}

/**
 * Create fresh items for a future inspection or template.
 * Existing inspections keep their saved items; this function never reads or mutates records.
 * Conditional prompts remain unanswered until the inspector establishes applicability.
 */
export function buildResearchedChecklist(occupancy: string, systems: readonly string[] = []): ResearchedChecklistItem[] {
  const profile = getChecklistProfile(occupancy);
  const prefix = normalize(profile.occupancy).replace(/[^a-z0-9]+/g, '-');
  const makeItem = (
    question: ResearchQuestion,
    origin: ResearchedChecklistItem['researchOrigin'],
    module?: ChecklistSystemModule,
  ): ResearchedChecklistItem => {
    const sources = question.sourceIds.flatMap(id => {
      const source = sourceById.get(id);
      return source ? [{...source}] : [];
    });
    // The legacy field is labeled "Official source URL" in the editor.
    // Forum discovery stays in explicitly labeled provenance, never in that field.
    const officialSource = sources.find(source => source.type !== 'forum lead');
    return {
      ...question,
      id: prefix + '-' + question.id,
      sourceIds: [...question.sourceIds],
      reference: 'Inspection prompt — exact citation and applicability require review',
      sourceUrl: officialSource?.url ?? municipalCodeUrl,
      verified: false,
      researchSources: sources,
      researchCheckedOn: research.checkedOn,
      researchOrigin: origin,
      ...(module ? {researchModuleId: module.id, researchModuleLabel: module.label} : {}),
    };
  };
  return [
    ...research.sharedCore.map(question => makeItem(question, 'shared')),
    ...profile.questions.map(question => makeItem(question, 'occupancy')),
    ...getChecklistModules(systems).flatMap(module => module.questions.map(question => makeItem(question, 'system', module))),
  ];
}
