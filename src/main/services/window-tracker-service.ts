import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { WindowBinding, TrackedExternalWindow, WindowBounds } from "@shared/types";

const execFileAsync = promisify(execFile);

const normalizeTitle = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();
const assistantWindowPattern =
  /(xg5000 assistant console|xg5000 overlay tutor|xg5000 side assistant|assistant console|overlay tutor)/i;
const xg5000Pattern = /\bxg5000\b/i;
const electronProcessNames = new Set(["electron", "saas", "xg5000-assistant-console"]);

const hasUsefulTitle = (value: string) => {
  const normalized = normalizeTitle(value);
  return Boolean(normalized) && normalized !== "program manager";
};

const isAssistantWindow = (title: string, appName: string) =>
  assistantWindowPattern.test(title) || assistantWindowPattern.test(appName);

const normalizeProcessName = (value: string) => normalizeTitle(value).replace(/\.exe$/, "");

const isElectronOwnedWindow = (appName: string) => electronProcessNames.has(normalizeProcessName(appName));
const matchesXg5000 = (title: string, appName: string) => xg5000Pattern.test(title) || xg5000Pattern.test(appName);

const parseBounds = (input: {
  Left?: number;
  Top?: number;
  Width?: number;
  Height?: number;
}): WindowBounds => ({
  x: Number(input.Left ?? 0),
  y: Number(input.Top ?? 0),
  width: Math.max(0, Number(input.Width ?? 0)),
  height: Math.max(0, Number(input.Height ?? 0)),
});

type ProbeWindow = {
  id: string;
  handle: string;
  title: string;
  appName: string;
  bounds: WindowBounds;
  visible: boolean;
  minimized: boolean;
  followable: boolean;
  lastSeenAt: string;
};

type CandidateWindow = {
  title: string;
  appName: string;
  visible?: boolean;
  minimized?: boolean;
  followable?: boolean;
};

export const isXg5000CandidateWindow = (item: CandidateWindow) =>
  matchesXg5000(item.title, item.appName) &&
  !isAssistantWindow(item.title, item.appName) &&
  !isElectronOwnedWindow(item.appName) &&
  item.visible !== false &&
  item.minimized !== true &&
  item.followable !== false;

export interface ExternalWindowProbe {
  listWindows(): Promise<ProbeWindow[]>;
}

class PowerShellWindowProbe implements ExternalWindowProbe {
  async listWindows(): Promise<ProbeWindow[]> {
    if (process.platform !== "win32") {
      return [];
    }

    const command = `
$signature = @"
using System;
using System.Runtime.InteropServices;
public struct RECT {
  public int Left;
  public int Top;
  public int Right;
  public int Bottom;
}
public static class Win32 {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
"@;
Add-Type -TypeDefinition $signature -ErrorAction SilentlyContinue | Out-Null;
$windows = Get-Process |
  Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle } |
  ForEach-Object {
    $rect = New-Object RECT
    [Win32]::GetWindowRect($_.MainWindowHandle, [ref]$rect) | Out-Null
    [pscustomobject]@{
      id = "win:" + $_.MainWindowHandle
      handle = ("0x{0:X}" -f $_.MainWindowHandle)
      title = $_.MainWindowTitle
      appName = $_.ProcessName
      Left = $rect.Left
      Top = $rect.Top
      Width = $rect.Right - $rect.Left
      Height = $rect.Bottom - $rect.Top
      Visible = [Win32]::IsWindowVisible($_.MainWindowHandle)
      Minimized = [Win32]::IsIconic($_.MainWindowHandle)
      Followable = ($rect.Right - $rect.Left) -gt 0 -and ($rect.Bottom - $rect.Top) -gt 0
      LastSeenAt = [DateTime]::UtcNow.ToString("o")
    }
  };
$windows | ConvertTo-Json -Depth 4 -Compress
`;

    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", command], {
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 4,
    });

    const parsed = stdout.trim() ? (JSON.parse(stdout) as Array<Record<string, unknown>> | Record<string, unknown>) : [];
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows
      .map((row) => ({
        id: String(row.id ?? crypto.randomUUID()),
        handle: String(row.handle ?? ""),
        title: String(row.title ?? ""),
        appName: String(row.appName ?? "Window"),
        bounds: parseBounds(row as never),
        visible: Boolean(row.Visible ?? row.visible),
        minimized: Boolean(row.Minimized ?? row.minimized),
        followable: Boolean(row.Followable ?? row.followable),
        lastSeenAt: String(row.LastSeenAt ?? row.lastSeenAt ?? new Date().toISOString()),
      }))
      .filter((row) => hasUsefulTitle(row.title));
  }
}

const scoreWindow = (binding: WindowBinding, candidate: ProbeWindow) => {
  const bindingTitle = normalizeTitle(binding.title);
  const candidateTitle = normalizeTitle(candidate.title);
  const bindingApp = normalizeTitle(binding.appName);
  const candidateApp = normalizeTitle(candidate.appName);

  let score = 0;
  if (bindingTitle === candidateTitle) score += 6;
  if (candidateTitle.includes(bindingTitle) || bindingTitle.includes(candidateTitle)) score += 4;
  if (bindingApp && candidateApp.includes(bindingApp)) score += 2;
  if (matchesXg5000(candidate.title, candidate.appName)) score += 4;
  if (isXg5000CandidateWindow(candidate)) score += 3;
  if (score > 0 && candidate.visible) score += 2;
  if (score > 0 && !candidate.minimized) score += 1;
  return score;
};

export class WindowTrackerService {
  constructor(private readonly probe: ExternalWindowProbe = new PowerShellWindowProbe()) {}

  async listTrackedWindows(): Promise<TrackedExternalWindow[]> {
    const windows = await this.probe.listWindows();
    return windows
      .filter((item) => !isAssistantWindow(item.title, item.appName))
      .map((item): TrackedExternalWindow => {
        const matchedBy: TrackedExternalWindow["matchedBy"] = matchesXg5000(item.title, item.appName) ? "title" : "recent";
        return {
          ...item,
          matchedBy,
        };
      })
      .sort((left, right) => {
        const rightScore =
          Number(matchesXg5000(right.title, right.appName)) * 10 +
          Number(right.visible) * 2 +
          Number(!right.minimized);
        const leftScore =
          Number(matchesXg5000(left.title, left.appName)) * 10 +
          Number(left.visible) * 2 +
          Number(!left.minimized);
        return rightScore - leftScore || right.lastSeenAt.localeCompare(left.lastSeenAt);
      });
  }

  async getTargetWindow(binding: WindowBinding | null | undefined): Promise<TrackedExternalWindow | null> {
    const windows = await this.listTrackedWindows();
    if (!binding) {
      return windows.find(isXg5000CandidateWindow) ?? null;
    }

    const matches = windows
      .map((candidate) => ({ candidate, score: scoreWindow(binding, candidate) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || right.candidate.lastSeenAt.localeCompare(left.candidate.lastSeenAt));

    const preferredMatches = matches.filter((item) => isXg5000CandidateWindow(item.candidate));
    const best = preferredMatches[0]?.candidate ?? null;
    if (!best) {
      return null;
    }

    return {
      ...best,
      sourceId: binding.sourceId,
      matchedBy: best.handle === binding.handle ? "handle" : binding.matchedBy,
    };
  }

  async getTrackedWindow(
    bindingId: string,
    resolver: (bindingId: string) => Promise<WindowBinding | null>,
  ): Promise<TrackedExternalWindow | null> {
    const binding = await resolver(bindingId);
    return this.getTargetWindow(binding);
  }
}
