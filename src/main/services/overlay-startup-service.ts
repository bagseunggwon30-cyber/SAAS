import type { OverlayMode } from "@shared/types";

export interface OverlayStartupDeps {
  resolveStartupBinding(bindingId?: string): Promise<{ id: string } | null>;
  attachWindow(): void;
  startFollowing(bindingId: string): Promise<void>;
  showFallback(): void;
}

export const resolveStartupOverlayMode = (mode: OverlayMode | null | undefined): OverlayMode =>
  mode === "detached" ? "bubble" : mode ?? "bubble";

export class OverlayStartupService {
  constructor(private readonly deps: OverlayStartupDeps) {}

  async boot(bindingId?: string) {
    const binding = await this.deps.resolveStartupBinding(bindingId);

    this.deps.attachWindow();

    const started = await this.tryStartFollowing(binding);
    if (started) {
      return started;
    }

    if (bindingId) {
      const fallback = await this.deps.resolveStartupBinding();
      if (fallback && fallback.id !== binding?.id) {
        const fallbackStarted = await this.tryStartFollowing(fallback);
        if (fallbackStarted) {
          return fallbackStarted;
        }
      }
    }

    this.deps.showFallback();
    return null;
  }

  private async tryStartFollowing(binding: { id: string } | null): Promise<{ id: string } | null> {
    if (!binding) {
      return null;
    }

    try {
      await this.deps.startFollowing(binding.id);
      return binding;
    } catch {
      return null;
    }
  }
}
