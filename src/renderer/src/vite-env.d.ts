/// <reference types="vite/client" />

import type { RendererApi } from "@shared/types";

declare global {
  interface Window {
    xg5000: RendererApi;
  }
}

export {};
