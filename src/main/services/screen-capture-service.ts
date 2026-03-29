import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { desktopCapturer } from "electron";

import type { DatabaseClient } from "@main/db/database";
import type { AssistantMode, CaptureSession } from "@shared/types";

import { WindowBindingService } from "./window-binding-service";

export class ScreenCaptureService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly bindings: WindowBindingService,
    private readonly captureRoot: string,
  ) {
    mkdirSync(captureRoot, { recursive: true });
  }

  async captureCurrent(mode: AssistantMode = "observe"): Promise<CaptureSession | null> {
    const binding = await this.bindings.resolve();
    if (!binding) {
      return null;
    }
    return this.captureBinding(binding.id, mode);
  }

  async captureBinding(bindingId: string, mode: AssistantMode = "observe"): Promise<CaptureSession | null> {
    const binding = await this.bindings.resolve(bindingId);
    if (!binding) {
      return null;
    }

    const sources = await desktopCapturer.getSources({
      types: ["window"],
      thumbnailSize: { width: 1600, height: 1000 },
      fetchWindowIcons: false,
    });
    const source =
      sources.find((item) => item.id === binding.sourceId) ??
      sources.find((item) => item.name === binding.title);

    if (!source) {
      return null;
    }

    const id = crypto.randomUUID();
    const imagePath = join(this.captureRoot, `${id}.png`);
    writeFileSync(imagePath, source.thumbnail.toPNG());

    return this.db.saveCaptureSession({
      id,
      mode,
      bindingId: binding.id,
      sourceId: binding.sourceId,
      windowTitle: binding.title,
      appName: binding.appName,
      imagePath,
      thumbnailPath: imagePath,
      ocrText: "",
    });
  }
}
