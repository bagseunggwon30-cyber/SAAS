import { desktopCapturer } from "electron";

import type { DatabaseClient } from "@main/db/database";
import type { WindowBinding, WindowBindingSelectionRequest } from "@shared/types";

import { isXg5000CandidateWindow, WindowTrackerService } from "./window-tracker-service";

const assistantWindowPattern =
  /(xg5000 assistant console|xg5000 overlay tutor|xg5000 side assistant|assistant console|overlay tutor)/i;
const electronProcessNames = new Set(["electron", "saas", "xg5000-assistant-console"]);

const isAssistantWindow = (title: string) => assistantWindowPattern.test(title);
const normalizeTitle = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();
const normalizeProcessName = (value: string) => value.replace(/\.exe$/i, "").trim().toLowerCase();
const isElectronOwnedBinding = (binding: WindowBinding) => electronProcessNames.has(normalizeProcessName(binding.appName ?? ""));
const isEligibleLiveFallbackBinding = (binding: WindowBinding) =>
  !isAssistantWindow(binding.title) && !isElectronOwnedBinding(binding);

const isXg5000CandidateBinding = (binding: WindowBinding) =>
  isXg5000CandidateWindow({
    title: binding.title,
    appName: binding.appName,
    visible: binding.visible,
    minimized: binding.minimized,
    followable: binding.followable,
  });

const titlesLikelySame = (left: string, right: string) => {
  const normalizedLeft = normalizeTitle(left);
  const normalizedRight = normalizeTitle(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) {
    return true;
  }
  return false;
};

const isLiveBinding = (binding: WindowBinding) =>
  binding.visible !== false &&
  binding.minimized !== true &&
  binding.followable !== false &&
  isEligibleLiveFallbackBinding(binding);

const isVisibleFollowableXg5000 = (binding: WindowBinding) => isXg5000CandidateBinding(binding) && isLiveBinding(binding);

const inferAppName = (title: string) => {
  if (/xg5000/i.test(title)) {
    return "XG5000";
  }
  return title.split("-")[0]?.trim() || "Window";
};

const compareBindings = (left: WindowBinding, right: WindowBinding) => {
  const leftScore = Number(left.selected) * 10 + Number(/xg5000/i.test(left.title) || /xg5000/i.test(left.appName)) * 5;
  const rightScore = Number(right.selected) * 10 + Number(/xg5000/i.test(right.title) || /xg5000/i.test(right.appName)) * 5;
  return rightScore - leftScore || right.lastSeenAt.localeCompare(left.lastSeenAt);
};

const compareXg5000Candidates = (left: WindowBinding, right: WindowBinding) => {
  const leftScore =
    Number(left.visible === true) * 8 + Number(left.followable !== false) * 3 + Number(left.minimized !== true) * 2 + Number(left.selected) * 2;
  const rightScore =
    Number(right.visible === true) * 8 + Number(right.followable !== false) * 3 + Number(right.minimized !== true) * 2 + Number(right.selected) * 2;
  return rightScore - leftScore || right.lastSeenAt.localeCompare(left.lastSeenAt);
};

const compareLiveCandidates = (left: WindowBinding, right: WindowBinding) => {
  const leftScore =
    Number(left.selected) * 3 +
    Number(/xg5000/i.test(left.title) || /xg5000/i.test(left.appName)) * 4 +
    Number(left.visible === true) * 2 +
    Number(left.minimized !== true);
  const rightScore =
    Number(right.selected) * 3 +
    Number(/xg5000/i.test(right.title) || /xg5000/i.test(right.appName)) * 4 +
    Number(right.visible === true) * 2 +
    Number(right.minimized !== true);
  return rightScore - leftScore || right.lastSeenAt.localeCompare(left.lastSeenAt);
};

export class WindowBindingService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly tracker: WindowTrackerService = new WindowTrackerService(),
  ) {}

  async list(): Promise<WindowBinding[]> {
    const sources = await desktopCapturer.getSources({
      types: ["window"],
      fetchWindowIcons: false,
      thumbnailSize: { width: 640, height: 360 },
    });

    const known = new Map(this.db.getWindowBindings(24).map((item) => [item.sourceId, item]));
    const trackedWindows = await this.tracker.listTrackedWindows();
    const xg5000TrackedWindows = trackedWindows.filter(isXg5000CandidateWindow);
    const bindings = sources
      .filter((source) => source.name && !isAssistantWindow(source.name))
      .map((source) => {
        const existing = known.get(source.id);
        const tracked =
          trackedWindows.find((item) => item.sourceId === source.id || titlesLikelySame(item.title, source.name)) ??
          (/xg5000/i.test(source.name) && xg5000TrackedWindows.length === 1 ? xg5000TrackedWindows[0] : undefined);
        return this.db.upsertWindowBinding({
          id: existing?.id,
          sourceId: source.id,
          title: source.name,
          appName: tracked?.appName ?? existing?.appName ?? inferAppName(source.name),
          matchedBy: existing?.matchedBy ?? (/xg5000/i.test(source.name) ? "title" : "recent"),
          selected: existing?.selected ?? false,
          handle: tracked?.handle,
          bounds: tracked?.bounds,
          visible: tracked?.visible,
          minimized: tracked?.minimized,
          followable: tracked?.followable,
        });
      });

    return bindings.sort(compareBindings);
  }

  async resolveStartupBinding(bindingId?: string): Promise<WindowBinding | null> {
    const bindings = await this.list();
    const exact = bindingId ? bindings.find((item) => item.id === bindingId) ?? null : null;
    const visibleCandidates = bindings.filter(isVisibleFollowableXg5000).sort(compareXg5000Candidates);

    if (exact && isVisibleFollowableXg5000(exact)) {
      return exact;
    }

    return visibleCandidates[0] ?? null;
  }

  async resolveLiveBinding(bindingId?: string): Promise<WindowBinding | null> {
    const startup = await this.resolveStartupBinding(bindingId);
    if (startup) {
      return startup;
    }

    const bindings = await this.list();
    const exact = bindingId ? bindings.find((item) => item.id === bindingId) ?? null : null;
    const liveCandidates = bindings
      .filter((item) => isLiveBinding(item) && isXg5000CandidateBinding(item))
      .sort(compareLiveCandidates);

    if (exact && isLiveBinding(exact) && isXg5000CandidateBinding(exact)) {
      return exact;
    }

    return liveCandidates[0] ?? null;
  }

  async select(input: WindowBindingSelectionRequest): Promise<WindowBinding> {
    const saved = this.db.upsertWindowBinding({
      sourceId: input.sourceId,
      title: input.title,
      appName: input.appName ?? inferAppName(input.title),
      matchedBy: "manual",
      selected: true,
    });
    const tracked = await this.tracker.getTargetWindow(saved);
    return tracked
      ? {
          ...saved,
          handle: tracked.handle,
          bounds: tracked.bounds,
          visible: tracked.visible,
          minimized: tracked.minimized,
          followable: tracked.followable,
        }
      : saved;
  }

  getSelected(): WindowBinding | null {
    return this.db.getSelectedWindowBinding();
  }

  async resolve(bindingId?: string): Promise<WindowBinding | null> {
    return this.resolveLiveBinding(bindingId);
  }
}
