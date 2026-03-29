import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { AgentAction, TrackedExternalWindow } from "@shared/types";

const execFileAsync = promisify(execFile);

type PowerShellBridge = {
  run(script: string): Promise<void>;
};

const defaultBridge: PowerShellBridge = {
  async run(script: string) {
    if (process.platform !== "win32") {
      return;
    }

    await execFileAsync("powershell.exe", ["-NoProfile", "-Command", script], {
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
  },
};

const toSendKeys = (accelerator: string) =>
  accelerator
    .split("+")
    .map((token) => token.trim())
    .reduce((result, token, index, parts) => {
      const normalized = token.toLowerCase();
      if (normalized === "ctrl" || normalized === "control") return `${result}^`;
      if (normalized === "shift") return `${result}+`;
      if (normalized === "alt") return `${result}%`;
      if (/^f\d+$/i.test(token)) return `${result}{${token.toUpperCase()}}`;
      const key = token.length === 1 ? token.toUpperCase() : token;
      return index === parts.length - 1 ? `${result}${key}` : `${result}{${key}}`;
    }, "");

const escapeSendKeysText = (value: string) => value.replace(/([+^%~(){}\[\]])/g, "{$1}");

export class UiAutomationService {
  constructor(private readonly bridge: PowerShellBridge = defaultBridge) {}

  async execute(action: AgentAction, targetWindow: TrackedExternalWindow | null): Promise<void> {
    if (action.type === "wait-for") {
      await new Promise((resolve) => setTimeout(resolve, action.waitForMs ?? 800));
      return;
    }

    if (process.platform !== "win32") {
      return;
    }

    const focusScript = targetWindow?.title
      ? `
Add-Type -AssemblyName Microsoft.VisualBasic;
[Microsoft.VisualBasic.Interaction]::AppActivate(${JSON.stringify(targetWindow.title)}) | Out-Null
Start-Sleep -Milliseconds 150
`
      : "";

    let body = "";
    if (action.type === "hotkey" && action.accelerator) {
      body = `
Add-Type -AssemblyName System.Windows.Forms;
[System.Windows.Forms.SendKeys]::SendWait(${JSON.stringify(toSendKeys(action.accelerator))})
`;
    } else if (action.type === "type" && typeof action.text === "string") {
      body = `
Add-Type -AssemblyName System.Windows.Forms;
[System.Windows.Forms.SendKeys]::SendWait(${JSON.stringify(escapeSendKeysText(action.text))})
`;
    } else if ((action.type === "click" || action.type === "double-click") && action.target?.x != null && action.target?.y != null) {
      const clickCount = action.type === "double-click" ? 2 : 1;
      body = `
$sig = @"
using System;
using System.Runtime.InteropServices;
public static class MouseOps {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
}
"@;
Add-Type -TypeDefinition $sig -ErrorAction SilentlyContinue | Out-Null;
[MouseOps]::SetCursorPos(${Math.round(action.target.x)}, ${Math.round(action.target.y)}) | Out-Null
1..${clickCount} | ForEach-Object {
  [MouseOps]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  [MouseOps]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 120
}
`;
    } else {
      return;
    }

    await this.bridge.run(`${focusScript}${body}`);
  }
}
