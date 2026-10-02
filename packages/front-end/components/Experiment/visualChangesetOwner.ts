import { ExperimentInterfaceStringDates } from "shared/types/experiment";
import { ApiContextualBanditInterface } from "shared/validators";
import {
  canEditContextualBanditVisualChanges,
  getActiveVariations,
  getLatestPhaseVariations,
  getVisibleVariations,
} from "shared/experiments";

export type VisualChangesetOwnerVariation = {
  id: string;
  name: string;
  // Fraction of traffic (0-1) this variation receives today.
  weight: number;
  // Position the SDK uses for this variation (the `?<trackingKey>=N` preview
  // param). Undefined when the SDK isn't serving it yet.
  previewIndex?: number;
};

// What `VisualChangesetTable` needs from whatever owns the changesets. Both
// experiments and contextual bandits can supply it, so the table never
// has to know which one it is rendering for.
export type VisualChangesetOwnerView = {
  id: string;
  trackingKey: string;
  status: string;
  // Lower-case noun for copy ("experiment", "contextual bandit").
  noun: string;
  variations: VisualChangesetOwnerVariation[];
  // Whether visual changes may be edited right now (independent of the
  // caller's permission check, which the table takes separately).
  canEditChanges: boolean;
  canDeleteVariation: (index: number) => boolean;
  deleteVariation?: (variationId: string) => Promise<void>;
};

export function experimentVisualChangesetOwner(
  experiment: ExperimentInterfaceStringDates,
  deleteVariation?: (variationId: string) => Promise<void>,
): VisualChangesetOwnerView {
  const variations = getLatestPhaseVariations(experiment);
  const latestPhase = experiment.phases?.[experiment.phases.length - 1];
  const isDraft = experiment.status === "draft";
  return {
    id: experiment.id,
    trackingKey: experiment.trackingKey,
    status: experiment.status,
    noun: "experiment",
    variations: variations.map((v, i) => ({
      id: v.id,
      name: v.name,
      weight: latestPhase?.variationWeights?.[i] ?? 0,
      previewIndex: i,
    })),
    canEditChanges: isDraft,
    canDeleteVariation: (index) =>
      isDraft && index !== 0 && variations.length > 2,
    deleteVariation,
  };
}

export function contextualBanditVisualChangesetOwner(
  cb: ApiContextualBanditInterface,
  deleteVariation?: (variationId: string) => Promise<void>,
): VisualChangesetOwnerView {
  const variations = getVisibleVariations(cb.variations);
  // The SDK payload only carries active arms, so a pending arm has no
  // position to preview until it activates.
  const activeIds = getActiveVariations(cb.variations).map((v) => v.id);
  const weightFor = (variationId: string) =>
    cb.variationWeights?.find((w) => w.variationId === variationId)?.weight ??
    0;
  const isDraft = cb.status === "draft";
  return {
    id: cb.id,
    trackingKey: cb.trackingKey,
    status: cb.status,
    noun: "contextual bandit",
    variations: variations.map((v) => {
      const sdkIndex = activeIds.indexOf(v.id);
      return {
        id: v.id,
        name: v.name,
        weight: weightFor(v.id),
        previewIndex: sdkIndex >= 0 ? sdkIndex : undefined,
      };
    }),
    canEditChanges: canEditContextualBanditVisualChanges(cb),
    canDeleteVariation: (index) =>
      isDraft && index !== 0 && variations.length > 2,
    deleteVariation,
  };
}
