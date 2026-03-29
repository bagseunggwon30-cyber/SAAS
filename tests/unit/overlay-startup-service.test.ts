import { describe, expect, it, vi } from "vitest";

import { OverlayStartupService, resolveStartupOverlayMode } from "@main/services/overlay-startup-service";

describe("OverlayStartupService", () => {
  it("normalizes detached startup mode back to bubble", () => {
    expect(resolveStartupOverlayMode("detached")).toBe("bubble");
    expect(resolveStartupOverlayMode("docked")).toBe("docked");
    expect(resolveStartupOverlayMode(undefined)).toBe("bubble");
  });

  it("resolves the startup binding before attaching and following", async () => {
    const calls: string[] = [];
    const service = new OverlayStartupService({
      resolveStartupBinding: vi.fn(async () => {
        calls.push("resolve");
        return { id: "binding-1" };
      }),
      attachWindow: vi.fn(() => {
        calls.push("attach");
      }),
      startFollowing: vi.fn(async (bindingId: string) => {
        calls.push(`follow:${bindingId}`);
      }),
      showFallback: vi.fn(() => {
        calls.push("fallback");
      }),
    });

    await service.boot("binding-1");

    expect(calls).toEqual(["resolve", "attach", "follow:binding-1"]);
  });

  it("attaches and shows fallback when no startup binding is available", async () => {
    const calls: string[] = [];
    const service = new OverlayStartupService({
      resolveStartupBinding: vi.fn(async () => {
        calls.push("resolve");
        return null;
      }),
      attachWindow: vi.fn(() => {
        calls.push("attach");
      }),
      startFollowing: vi.fn(async () => {
        calls.push("follow");
      }),
      showFallback: vi.fn(() => {
        calls.push("fallback");
      }),
    });

    await service.boot();

    expect(calls).toEqual(["resolve", "attach", "fallback"]);
  });

  it("retries with a fresh startup resolve when following the stored binding fails", async () => {
    const calls: string[] = [];
    const resolveStartupBinding = vi.fn(async (bindingId?: string) => {
      calls.push(`resolve:${bindingId ?? "none"}`);
      return bindingId === "binding-stale" ? { id: "binding-stale" } : { id: "binding-fallback" };
    });
    const startFollowing = vi.fn(async (bindingId: string) => {
      calls.push(`follow:${bindingId}`);
      if (bindingId === "binding-stale") {
        throw new Error("stale binding");
      }
    });
    const service = new OverlayStartupService({
      resolveStartupBinding,
      attachWindow: vi.fn(() => {
        calls.push("attach");
      }),
      startFollowing,
      showFallback: vi.fn(() => {
        calls.push("fallback");
      }),
    });

    const binding = await service.boot("binding-stale");

    expect(binding?.id).toBe("binding-fallback");
    expect(calls).toEqual([
      "resolve:binding-stale",
      "attach",
      "follow:binding-stale",
      "resolve:none",
      "follow:binding-fallback",
    ]);
    expect(resolveStartupBinding).toHaveBeenCalledTimes(2);
    expect(startFollowing).toHaveBeenCalledTimes(2);
  });

  it("explicitly retries with a fresh resolve when the requested binding is dead", async () => {
    const calls: string[] = [];
    const resolveStartupBinding = vi.fn(async (bindingId?: string) => {
      calls.push(`resolve:${bindingId ?? "none"}`);
      return bindingId ? null : { id: "binding-live" };
    });
    const startFollowing = vi.fn(async (bindingId: string) => {
      calls.push(`follow:${bindingId}`);
    });
    const service = new OverlayStartupService({
      resolveStartupBinding,
      attachWindow: vi.fn(() => {
        calls.push("attach");
      }),
      startFollowing,
      showFallback: vi.fn(() => {
        calls.push("fallback");
      }),
    });

    const binding = await service.boot("binding-dead");

    expect(binding?.id).toBe("binding-live");
    expect(calls).toEqual(["resolve:binding-dead", "attach", "resolve:none", "follow:binding-live"]);
    expect(resolveStartupBinding).toHaveBeenCalledTimes(2);
    expect(startFollowing).toHaveBeenCalledTimes(1);
  });

  it("shows fallback when stored binding follow fails and no fallback binding resolves", async () => {
    const calls: string[] = [];
    const resolveStartupBinding = vi.fn(async (bindingId?: string) => {
      calls.push(`resolve:${bindingId ?? "none"}`);
      return bindingId === "binding-stale" ? { id: "binding-stale" } : null;
    });
    const startFollowing = vi.fn(async (bindingId: string) => {
      calls.push(`follow:${bindingId}`);
      throw new Error("stale binding");
    });
    const service = new OverlayStartupService({
      resolveStartupBinding,
      attachWindow: vi.fn(() => {
        calls.push("attach");
      }),
      startFollowing,
      showFallback: vi.fn(() => {
        calls.push("fallback");
      }),
    });

    const binding = await service.boot("binding-stale");

    expect(binding).toBeNull();
    expect(calls).toEqual(["resolve:binding-stale", "attach", "follow:binding-stale", "resolve:none", "fallback"]);
    expect(resolveStartupBinding).toHaveBeenCalledTimes(2);
    expect(startFollowing).toHaveBeenCalledTimes(1);
  });
});
