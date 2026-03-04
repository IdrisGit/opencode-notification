import { readFileSync } from "node:fs";

const terminalMap: Record<string, { icon: string; appName: string }> = {
  ghostty: { icon: "com.mitchellh.ghostty", appName: "Ghostty" },
  wezterm: { icon: "org.wezfurlong.wezterm", appName: "WezTerm" },
  kitty: { icon: "kitty", appName: "Kitty" },
  alacritty: { icon: "Alacritty", appName: "Alacritty" },
  gnome_terminal: { icon: "org.gnome.Terminal", appName: "GNOME Terminal" },
  warp: { icon: "dev.warp.Warp", appName: "Warp" },
  konsole: { icon: "utilities-terminal", appName: "Konsole" },
};

function getLinuxTerminalInfo(): { icon: string; appName: string } | null {
  let cachedTerminal: { icon: string; appName: string } | null | undefined;

  if (process.platform !== "linux") return null;
  if (cachedTerminal !== undefined) return cachedTerminal;

  const termProgram = process.env.TERM_PROGRAM?.toLowerCase();
  if (termProgram && terminalMap[termProgram]) {
    cachedTerminal = terminalMap[termProgram];
    return cachedTerminal;
  }

  let currentPid = process.pid;
  for (let i = 0; i < 3 && currentPid > 1; i++) {
    const status = readFileSync(`/proc/${currentPid}/status`, "utf-8");
    const ppidMatch = status.match(/PPid:\s*(\d+)/);
    if (!ppidMatch || !ppidMatch[1]) break;
    const ppid = parseInt(ppidMatch[1], 10);
    if (ppid <= 1 || ppid === currentPid) break;

    const comm = readFileSync(`/proc/${ppid}/comm`, "utf-8").trim();
    const normalized = comm.replace(/-/g, "_");
    const result = terminalMap[comm] ?? terminalMap[normalized] ?? null;
    if (result) {
      cachedTerminal = result;
      return result;
    }
    currentPid = ppid;
  }

  cachedTerminal = null;
  return null;
}

function notifyLinux(title: string, message: string): void {
  const notifySend = Bun.which("notify-send");
  if (!notifySend) {
    notifyBell();
    return;
  }
  const terminal = getLinuxTerminalInfo();
  const args = [notifySend];
  if (terminal) {
    args.push("-a", terminal.appName);
    args.push("-i", terminal.icon);
  }

  Bun.spawn([...args, title, message], {
    stdout: "ignore",
    stderr: "ignore",
  });
}

function escapeForAppleScript(text: string): string {
  return text.replace(/[\\"]/g, "\\$&");
}

function notifyMacOS(title: string, message: string): void {
  const escapedTitle = escapeForAppleScript(title);
  const escapedMessage = escapeForAppleScript(message);
  const script = `display notification "${escapedMessage}" with title "${escapedTitle}" sound name "Ping"`;

  Bun.spawn(["osascript", "-e", script], {
    stdout: "ignore",
    stderr: "ignore",
  });
}

function notifyWindows(title: string, message: string): void {
  const powershell = Bun.which("powershell.exe");
  if (powershell) {
    const script = `
      [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
      $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
      $rawXml = [xml] $template.GetXml()
      ($rawXml.toast.visual.binding.text | Where-Object { $_.id -eq "1" }).AppendChild($rawXml.CreateTextNode("${title.replace(/"/g, '\`"')}")) > $null
      ($rawXml.toast.visual.binding.text | Where-Object { $_.id -eq "2" }).AppendChild($rawXml.CreateTextNode("${message.replace(/"/g, '\`"')}")) > $null
      $serializedXml = New-Object Windows.Data.Xml.Dom.XmlDocument
      $serializedXml.LoadXml($rawXml.OuterXml)
      $toast = [Windows.UI.Notifications.ToastNotification]::new($serializedXml)
      $toast.Tag = "OpenCode"
      $toast.Group = "OpenCode"
      $toast.ExpirationTime = [DateTimeOffset]::Now.AddMinutes(1)
      $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("OpenCode")
      $notifier.Show($toast)
    `.trim();

    Bun.spawn(
      [powershell, "-NonInteractive", "-NoProfile", "-Command", script],
      {
        stdout: "ignore",
        stderr: "ignore",
      },
    );
    return;
  }

  const msg = Bun.which("msg");
  if (msg) {
    Bun.spawn([msg, "*", "/TIME:3", `${title}: ${message}`], {
      stdout: "ignore",
      stderr: "ignore",
    });
    return;
  }

  notifyBell();
}

function notifyBell(): void {
  if (process.stdout.isTTY) {
    process.stdout.write("\x07");
  }
}

export namespace Notification {
  export type Options = {
    title: string;
    message?: string;
  };

  export function notify({ title, message = "" }: Options): void {
    if (process.platform === "darwin") {
      notifyMacOS(title, message);
      return;
    }

    if (process.platform === "linux") {
      notifyLinux(title, message);
      return;
    }

    if (process.platform === "win32") {
      notifyWindows(title, message);
      return;
    }

    notifyBell();
  }
}
