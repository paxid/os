(() => {
  "use strict";

  let zIndexSeed = 100;
  const openWindows = new Map();
  const icons = {};
  let clockTimer = null;

  const bootScreen = document.getElementById("boot-screen");
  const loginScreen = document.getElementById("login-screen");
  const desktop = document.getElementById("desktop");
  const dock = document.getElementById("dock");
  const appGrid = document.getElementById("app-grid");
  const panelClock = document.getElementById("panel-clock");
  const fullscreenToggle = document.getElementById("fullscreen-toggle");
  const desktopArea = document.getElementById("desktop-area");

  const WALLPAPERS = {
    a: "wallpaper-a",
    b: "wallpaper-b",
    c: "wallpaper-c",
    d: "wallpaper-d"
  };

  const ACCENT_THEMES = {
    sunset: { name: "Sunset", primary: "#f98b00", secondary: "#ff6400" },
    ocean: { name: "Ocean", primary: "#00bcd4", secondary: "#007d91" },
    aurora: { name: "Aurora", primary: "#74d680", secondary: "#378b29" },
    violet: { name: "Violet", primary: "#a077ff", secondary: "#6933ff" }
  };

  const HOMEPAGE_SHORTCUTS = [
    { label: "Ubuntu Wiki", url: "https://en.wikipedia.org/wiki/Ubuntu" },
    { label: "Ubuntu Docs", url: "https://ubuntu.com/tutorials" },
    { label: "Launchpad", url: "https://launchpad.net/" },
    { label: "Stack Overflow", url: "https://stackoverflow.com/questions/tagged/ubuntu" }
  ];

  const TEXT_EXTENSIONS = new Set(["txt", "md", "markdown", "log", "json", "js", "ts", "py", "html", "css", "sh", "conf", "ini", "yaml", "yml"]);

  const PACKAGE_DB = {
    neofetch: "system information tool",
    htop: "interactive process viewer",
    git: "distributed version control",
    nodejs: "JavaScript runtime",
    python3: "Python language runtime"
  };

  const INITIAL_FILESYSTEM = {
    directories: [
      "/home",
      "/home/ubuntu",
      "/home/ubuntu/Desktop",
      "/home/ubuntu/Documents",
      "/home/ubuntu/Documents/Guides",
      "/home/ubuntu/Downloads",
      "/home/ubuntu/Music",
      "/home/ubuntu/Pictures",
      "/home/ubuntu/Public",
      "/home/ubuntu/Templates",
      "/etc",
      "/usr/local/bin",
      "/var/log"
    ],
    files: {
      "/home/ubuntu/Desktop/Install Tips.txt": "Welcome to the Ubuntu Web Desktop.\n\n- Launch apps from Activities or the dock.\n- Files and Terminal share this virtual filesystem.\n- Use Settings to change wallpaper and accent colours.",
      "/home/ubuntu/Desktop/Welcome.md": "# Ubuntu Web Desktop\nA lightweight simulation of the Ubuntu desktop running entirely in your browser.",
      "/home/ubuntu/Documents/Project.md": "# Project Notes\n- This filesystem is stored in memory.\n- Changes persist for the session.\n- Export important text before closing the tab.",
      "/home/ubuntu/Documents/Guides/Terminal Cheatsheet.txt": "Useful commands:\n  ls, cd, pwd, mkdir, touch, cat, rm\n  apt update, apt install <pkg>\n  open <file> (opens in text editor)\n  history",
      "/home/ubuntu/Downloads/GettingStarted.zip": "[compressed archive placeholder]",
      "/home/ubuntu/Music/Playlist.txt": "1. Ambient Waves\n2. Cosmic Drift\n3. Terminal Velocity",
      "/home/ubuntu/Pictures/Wallpaper Ideas.txt": "Try the Settings app to change wallpapers.",
      "/etc/lsb-release": "DISTRIB_ID=Ubuntu\nDISTRIB_RELEASE=22.04\nDISTRIB_CODENAME=jammy\nDISTRIB_DESCRIPTION=\"Ubuntu Web Desktop\"",
      "/var/log/syslog": "System boot completed successfully."
    }
  };

  const INTERNAL_BROWSER_PAGES = {
    "about:ubuntu": {
      title: "Ubuntu Web",
      body: `<p>Welcome to the Ubuntu Web desktop. This browser is sandboxed, but you can open shortcuts in new tabs.</p>
             <ul>
               <li>Use the search box to perform a web search (opens in a new tab).</li>
               <li>Try <code>about:news</code> for simulated headlines.</li>
               <li>Use the Files app or Terminal to explore the virtual filesystem.</li>
             </ul>`
    },
    "about:news": {
      title: "Ubuntu Web Daily",
      body: `<h2>Headlines</h2>
             <ol>
               <li>Ubuntu Web Desktop reaches feature-complete beta.</li>
               <li>Developers embrace fully-local browser workspaces.</li>
               <li>Community themes and extensions arriving soon.</li>
             </ol>`
    },
    "about:release": {
      title: "Release Notes",
      body: `<h2>Ubuntu Web Desktop 22.04</h2>
             <p>This release introduces:</p>
             <ul>
               <li>Shared virtual filesystem across apps.</li>
               <li>Simulated APT package manager output.</li>
               <li>Customisable wallpapers and accent colours.</li>
             </ul>`
    }
  };

  const userSettings = {
    wallpaper: "a",
    accent: "sunset",
    clock24hr: false
  };

  class VirtualFileSystem {
    constructor(seed) {
      this.root = this._createDirectory("");
      if (seed?.directories) {
        seed.directories.forEach(dir => {
          try {
            this.makeDir(dir);
          } catch (error) {
            console.warn(error);
          }
        });
      }
      if (seed?.files) {
        Object.entries(seed.files).forEach(([path, content]) => {
          this.writeFile(path, content);
        });
      }
    }

    _createDirectory(name) {
      return {
        name,
        type: "directory",
        children: Object.create(null),
        modifiedAt: new Date()
      };
    }

    _createFile(name, content = "") {
      return {
        name,
        type: "file",
        content,
        modifiedAt: new Date()
      };
    }

    _normalize(path, cwd = "/") {
      const reference = (path ?? "").trim() || ".";
      const formatted = reference.replace(/\\/g, "/");
      const base = formatted.startsWith("/") ? formatted : `${cwd}/${formatted}`;
      const segments = [];
      base.replace(/\/+/g, "/")
        .split("/")
        .forEach((part, index) => {
          if (part === "" && index === 0) {
            return;
          }
          if (!part || part === ".") {
            return;
          }
          if (part === "..") {
            segments.pop();
            return;
          }
          segments.push(part);
        });
      return segments;
    }

    _pathFromSegments(segments) {
      return segments.length ? `/${segments.join("/")}` : "/";
    }

    _getNodeBySegments(segments) {
      let node = this.root;
      for (const segment of segments) {
        if (node.type !== "directory") {
          return null;
        }
        node = node.children[segment];
        if (!node) {
          return null;
        }
      }
      return node;
    }

    _ensureDirectorySegments(segments) {
      let node = this.root;
      for (const segment of segments) {
        if (!node.children[segment]) {
          node.children[segment] = this._createDirectory(segment);
        }
        node = node.children[segment];
        if (node.type !== "directory") {
          throw new Error("Path conflicts with an existing file.");
        }
      }
      return node;
    }

    resolve(path, cwd = "/") {
      const segments = this._normalize(path, cwd);
      return this._pathFromSegments(segments);
    }

    makeDir(path, cwd = "/") {
      const segments = this._normalize(path, cwd);
      this._ensureDirectorySegments(segments);
      return this._pathFromSegments(segments);
    }

    touch(path, cwd = "/") {
      const segments = this._normalize(path, cwd);
      if (!segments.length) {
        throw new Error("Cannot touch root directory.");
      }
      const fileName = segments.pop();
      const dir = this._ensureDirectorySegments(segments);
      if (!dir.children[fileName]) {
        dir.children[fileName] = this._createFile(fileName, "");
      }
      dir.children[fileName].modifiedAt = new Date();
      dir.modifiedAt = new Date();
      return this._pathFromSegments([...segments, fileName]);
    }

    writeFile(path, content = "", cwd = "/") {
      const segments = this._normalize(path, cwd);
      if (!segments.length) {
        throw new Error("Invalid file path.");
      }
      const fileName = segments.pop();
      const dir = this._ensureDirectorySegments(segments);
      dir.children[fileName] = this._createFile(fileName, content);
      dir.modifiedAt = new Date();
      return this._pathFromSegments([...segments, fileName]);
    }

    readFile(path, cwd = "/") {
      const node = this._getNodeBySegments(this._normalize(path, cwd));
      if (!node || node.type !== "file") {
        throw new Error("File not found.");
      }
      return node.content;
    }

    list(path = "/", cwd = "/") {
      const segments = this._normalize(path, cwd);
      const node = this._getNodeBySegments(segments);
      if (!node) {
        throw new Error("Directory not found.");
      }
      if (node.type !== "directory") {
        throw new Error("Not a directory.");
      }
      return Object.values(node.children)
        .map(child => ({
          name: child.name,
          type: child.type,
          path: this._pathFromSegments([...segments, child.name]),
          modifiedAt: child.modifiedAt
        }))
        .sort((a, b) => {
          if (a.type === b.type) {
            return a.name.localeCompare(b.name);
          }
          return a.type === "directory" ? -1 : 1;
        });
    }

    remove(path, cwd = "/") {
      const segments = this._normalize(path, cwd);
      if (!segments.length) {
        throw new Error("Cannot remove root.");
      }
      const name = segments.pop();
      const dir = this._getNodeBySegments(segments);
      if (!dir || dir.type !== "directory" || !dir.children[name]) {
        throw new Error("Path not found.");
      }
      const target = dir.children[name];
      if (target.type === "directory" && Object.keys(target.children).length > 0) {
        throw new Error("Directory not empty.");
      }
      delete dir.children[name];
      dir.modifiedAt = new Date();
      return true;
    }

    stat(path, cwd = "/") {
      const segments = this._normalize(path, cwd);
      const node = this._getNodeBySegments(segments);
      if (!node) {
        return null;
      }
      return {
        name: node.name || "/",
        type: node.type,
        path: this._pathFromSegments(segments),
        modifiedAt: node.modifiedAt
      };
    }

    fileExists(path, cwd = "/") {
      const node = this._getNodeBySegments(this._normalize(path, cwd));
      return !!(node && node.type === "file");
    }

    directoryExists(path, cwd = "/") {
      const node = this._getNodeBySegments(this._normalize(path, cwd));
      return !!(node && node.type === "directory");
    }
  }

  const vfs = new VirtualFileSystem(INITIAL_FILESYSTEM);
  let editorState = null;

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function startSequence() {
    bootScreen.classList.add("active");
    await delay(1500);
    bootScreen.classList.remove("active");
    loginScreen.classList.add("active");
  }

  function updateClock() {
    if (!desktop.classList.contains("active")) {
      return;
    }
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour12: !userSettings.clock24hr
    });
    panelClock.textContent = formatter.format(now);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  function ensureIconCache() {
    if (Object.keys(icons).length > 0) {
      return;
    }
    dock.querySelectorAll(".dock-item").forEach(btn => {
      const appId = btn.dataset.app;
      icons[appId] = btn;
    });
    appGrid.querySelectorAll("[data-app]").forEach(btn => {
      const appId = btn.dataset.app;
      icons[appId] = icons[appId] || btn;
    });
  }

  function showNotification(message, duration = 3400) {
    let container = document.querySelector(".floating-notification");
    if (!container) {
      container = document.createElement("div");
      container.className = "floating-notification";
      desktop.appendChild(container);
    }
    container.textContent = message;
    container.classList.add("visible");
    setTimeout(() => container.classList.remove("visible"), duration);
  }

  function focusWindow(win) {
    zIndexSeed += 1;
    win.style.zIndex = String(zIndexSeed);
    win.classList.remove("minimized");
    win.style.display = "flex";
  }

  function makeDraggable(win, header) {
    let pos = { x: 0, y: 0 };
    let dragging = false;
    let pointerId = null;

    header.addEventListener("dblclick", () => {
      const maximize = header.querySelector('[data-action="maximize"]');
      maximize?.click();
    });

    header.addEventListener("pointerdown", event => {
      if (event.target.closest(".window-controls")) {
        return;
      }
      if (win.classList.contains("maximized")) {
        return;
      }
      dragging = true;
      pointerId = event.pointerId;
      pos = {
        x: event.clientX - win.offsetLeft,
        y: event.clientY - win.offsetTop
      };
      if (header.setPointerCapture) {
        header.setPointerCapture(pointerId);
      }
    });

    header.addEventListener("pointermove", event => {
      if (!dragging) {
        return;
      }
      const left = event.clientX - pos.x;
      const top = event.clientY - pos.y;
      win.style.left = `${Math.max(16, left)}px`;
      win.style.top = `${Math.max(56, top)}px`;
    });

    const stopDragging = event => {
      if (pointerId !== event.pointerId) {
        return;
      }
      dragging = false;
      pointerId = null;
      if (header.hasPointerCapture && header.hasPointerCapture(event.pointerId)) {
        header.releasePointerCapture(event.pointerId);
      }
    };

    header.addEventListener("pointerup", stopDragging);
    header.addEventListener("pointerleave", stopDragging);
    header.addEventListener("pointercancel", stopDragging);
  }

  function attachWindowControls(win, appId, hooks = {}) {
    const minimizeBtn = win.querySelector('[data-action="minimize"]');
    const maximizeBtn = win.querySelector('[data-action="maximize"]');
    const closeBtn = win.querySelector('[data-action="close"]');
    const dockButton = icons[appId];

    minimizeBtn?.addEventListener("click", () => {
      win.classList.add("minimized");
      win.style.display = "none";
    });

    maximizeBtn?.addEventListener("click", () => {
      const isMax = win.classList.toggle("maximized");
      if (isMax) {
        win.dataset.prevLeft = win.style.left;
        win.dataset.prevTop = win.style.top;
        win.dataset.prevWidth = win.style.width;
        win.dataset.prevHeight = win.style.height;
      } else {
        win.style.left = win.dataset.prevLeft || "120px";
        win.style.top = win.dataset.prevTop || "120px";
        win.style.width = win.dataset.prevWidth || "520px";
        win.style.height = win.dataset.prevHeight || "380px";
      }
    });

    closeBtn?.addEventListener("click", () => {
      hooks.onClose?.();
      win.remove();
      openWindows.delete(appId);
      dockButton?.classList.remove("active");
    });

    win.addEventListener("pointerdown", () => focusWindow(win));
  }

  function createWindowShell(appId, title, iconClass) {
    const win = document.createElement("div");
    win.className = "window";
    win.style.left = `${120 + Math.random() * 180}px`;
    win.style.top = `${90 + Math.random() * 120}px`;
    win.style.width = "520px";
    win.style.height = "380px";
    win.dataset.app = appId;
    focusWindow(win);

    const header = document.createElement("div");
    header.className = "window-header";
    header.innerHTML = `
      <div class="window-controls">
        <button class="window-button" data-action="close" title="Close"></button>
        <button class="window-button" data-action="minimize" title="Minimize"></button>
        <button class="window-button" data-action="maximize" title="Maximize"></button>
      </div>
      <div class="window-title">
        <span class="icon ${iconClass}"></span>
        <span>${title}</span>
      </div>
    `;
    win.appendChild(header);

    const content = document.createElement("div");
    content.className = "window-content";
    win.appendChild(content);

    makeDraggable(win, header);
    desktopArea.appendChild(win);
    return { window: win, content, header };
  }

  function normalizePromptPath(path) {
    if (path === "/home/ubuntu") {
      return "~";
    }
    if (path.startsWith("/home/ubuntu/")) {
      return `~/${path.slice("/home/ubuntu/".length)}`;
    }
    return path;
  }

  function basename(path) {
    const segments = path.split("/").filter(Boolean);
    return segments.length ? segments[segments.length - 1] : "/";
  }

  function dirname(path) {
    const segments = path.split("/").filter(Boolean);
    segments.pop();
    return segments.length ? `/${segments.join("/")}` : "/";
  }

  function getFileExtension(path) {
    const name = basename(path);
    const index = name.lastIndexOf(".");
    return index >= 0 ? name.slice(index + 1).toLowerCase() : "";
  }

  function isTextFile(path) {
    return TEXT_EXTENSIONS.has(getFileExtension(path));
  }

  function expandUserPath(input) {
    if (!input) {
      return null;
    }
    const trimmed = input.trim();
    if (!trimmed) {
      return null;
    }
    if (trimmed === "~") {
      return "/home/ubuntu";
    }
    if (trimmed.startsWith("~/")) {
      return `/home/ubuntu/${trimmed.slice(2)}`.replace(/\/+/g, "/");
    }
    return trimmed;
  }

  function notifyFilesystemChange(path) {
    document.dispatchEvent(new CustomEvent("filesystem:changed", { detail: { path } }));
  }

  function setWallpaper(key) {
    userSettings.wallpaper = key;
    desktop.classList.remove(...Object.values(WALLPAPERS));
    desktop.classList.add(WALLPAPERS[key] || WALLPAPERS.a);
  }

  function applyAccentTheme(accentId) {
    const theme = ACCENT_THEMES[accentId] || ACCENT_THEMES.sunset;
    userSettings.accent = accentId;
    document.documentElement.style.setProperty("--accent-primary", theme.primary);
    document.documentElement.style.setProperty("--accent-secondary", theme.secondary);
  }

  function setClockPreference(use24hr) {
    userSettings.clock24hr = use24hr;
    updateClock();
  }

  function openTextFile(path) {
    if (!vfs.fileExists(path)) {
      showNotification(`File not found: ${path}`);
      return;
    }
    if (!isTextFile(path)) {
      showNotification(`Cannot open ${basename(path)} in the text editor.`);
      return;
    }
    launchApp("editor", { filePath: path });
  }

  function renderTerminal() {
    const shell = createWindowShell("terminal", "Terminal", "terminal");
    attachWindowControls(shell.window, "terminal");
    shell.content.classList.add("terminal");
    shell.content.innerHTML = `
      <div class="terminal-screen">
        <div class="terminal-output"></div>
        <div class="terminal-input">
          <span class="terminal-prompt"></span>
          <input class="terminal-input-field" type="text" spellcheck="false" autocomplete="off">
        </div>
      </div>
    `;

    const output = shell.content.querySelector(".terminal-output");
    const promptLabel = shell.content.querySelector(".terminal-prompt");
    const input = shell.content.querySelector(".terminal-input-field");

    const state = {
      cwd: "/home/ubuntu",
      history: [],
      index: 0
    };

    function promptText() {
      return `ubuntu@web:${normalizePromptPath(state.cwd)}$`;
    }

    function updatePrompt() {
      promptLabel.textContent = promptText();
    }

    function printLine(text = "", type = "line") {
      const line = document.createElement("div");
      line.className = `terminal-${type}`;
      line.textContent = text;
      output.appendChild(line);
      output.scrollTop = output.scrollHeight;
    }

    function tokenize(command) {
      const tokens = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < command.length; i += 1) {
        const char = command[i];
        if (char === "\"") {
          if (inQuotes && command[i + 1] === "\"") {
            current += "\"";
            i += 1;
          } else {
            inQuotes = !inQuotes;
          }
          continue;
        }
        if (!inQuotes && /\s/.test(char)) {
          if (current) {
            tokens.push(current);
            current = "";
          }
          continue;
        }
        current += char;
      }
      if (current) {
        tokens.push(current);
      }
      return tokens;
    }

    function runAptCommand(args) {
      if (!args.length) {
        return ["Usage: apt <command>"];
      }
      const sub = args[0];
      if (sub === "update") {
        return [
          "Hit:1 https://archive.ubuntu-web stable InRelease",
          "Reading package lists... Done",
          "Building dependency tree... Done",
          "All packages are up to date."
        ];
      }
      if (sub === "install") {
        const pkg = args[1];
        if (!pkg) {
          return ["Usage: apt install <package>"];
        }
        const description = PACKAGE_DB[pkg] || "virtual package";
        return [
          "Reading package lists... Done",
          "Building dependency tree... Done",
          "Reading state information... Done",
          "The following NEW packages will be installed:",
          `  ${pkg}`,
          "0 upgraded, 1 newly installed, 0 to remove and 0 not upgraded.",
          "Need to get 0 B of archives.",
          "After this operation, 0 B of additional disk space will be used.",
          `Selecting previously unselected package ${pkg}.`,
          "Preparing to unpack ...",
          `Unpacking ${pkg} (simulated)...`,
          `Setting up ${pkg} (${description}).`,
          "Installation simulated successfully."
        ];
      }
      return [`E: ${sub}: command not implemented in simulator`];
    }

    const handlers = {
      clear() {
        output.innerHTML = "";
        return [];
      },
      help() {
        return [
          "Available commands:",
          "  help               Show this help message",
          "  ls [path]          List directory contents",
          "  cd [path]          Change directory",
          "  pwd                Print working directory",
          "  cat <file>         Display text file contents",
          "  mkdir <dir>        Create directory",
          "  touch <file>       Create or update file timestamp",
          "  rm <file>          Remove file",
          "  history            Show command history",
          "  apt update|install Simulated APT commands",
          "  open <file>        Open text file in editor",
          "  nano <file>        Alias for open",
          "  date               Show current date",
          "  whoami             Display current user"
        ];
      },
      pwd() {
        return [state.cwd];
      },
      ls(args) {
        const target = args[0] || ".";
        const entries = vfs.list(target, state.cwd);
        if (!entries.length) {
          return [""];
        }
        const names = entries.map(item => (item.type === "directory" ? `${item.name}/` : item.name));
        return [names.join("  ")];
      },
      cd(args) {
        const target = args[0] || "/home/ubuntu";
        const resolved = vfs.resolve(target, state.cwd);
        if (!vfs.directoryExists(resolved)) {
          throw new Error(`cd: no such file or directory: ${target}`);
        }
        state.cwd = resolved || "/";
        updatePrompt();
        return [];
      },
      cat(args) {
        if (!args.length) {
          throw new Error("cat: missing file operand");
        }
        const resolved = vfs.resolve(args[0], state.cwd);
        if (!vfs.fileExists(resolved)) {
          throw new Error(`cat: ${args[0]}: No such file`);
        }
        if (!isTextFile(resolved)) {
          throw new Error(`cat: ${args[0]}: Binary file contents hidden`);
        }
        return vfs.readFile(resolved).split("\n");
      },
      mkdir(args) {
        if (!args.length) {
          throw new Error("mkdir: missing operand");
        }
        args.forEach(name => {
          vfs.makeDir(name, state.cwd);
        });
        notifyFilesystemChange(state.cwd);
        return [];
      },
      touch(args) {
        if (!args.length) {
          throw new Error("touch: missing file operand");
        }
        args.forEach(name => {
          vfs.touch(name, state.cwd);
        });
        notifyFilesystemChange(state.cwd);
        return [];
      },
      rm(args) {
        if (!args.length) {
          throw new Error("rm: missing operand");
        }
        args.forEach(name => {
          const stat = vfs.stat(name, state.cwd);
          if (!stat) {
            throw new Error(`rm: cannot remove '${name}': No such file or directory`);
          }
          if (stat.type === "directory") {
            throw new Error(`rm: cannot remove '${name}': Is a directory`);
          }
          vfs.remove(name, state.cwd);
        });
        notifyFilesystemChange(state.cwd);
        return [];
      },
      history() {
        return state.history.map((cmd, index) => `${index + 1}  ${cmd}`);
      },
      apt(args) {
        return runAptCommand(args);
      },
      open(args) {
        if (!args.length) {
          throw new Error("open: missing file operand");
        }
        const resolved = vfs.resolve(args[0], state.cwd);
        if (!vfs.fileExists(resolved)) {
          throw new Error(`open: cannot open '${args[0]}': No such file`);
        }
        if (!isTextFile(resolved)) {
          throw new Error(`open: '${args[0]}' is not a supported text file`);
        }
        openTextFile(resolved);
        return [`Opening ${normalizePromptPath(resolved)} in Text Editor...`];
      },
      nano(args) {
        return handlers.open(args);
      },
      date() {
        return [new Date().toString()];
      },
      whoami() {
        return ["ubuntu"];
      },
      about() {
        return [
          "Ubuntu Web Terminal",
          "A simulated shell implemented in vanilla JavaScript."
        ];
      }
    };

    function executeCommand(rawInput) {
      const raw = rawInput.trim();
      state.history.push(raw);
      state.index = state.history.length;
      printLine(`${promptText()} ${raw}`, "command");

      if (!raw) {
        return;
      }

      const [cmd, ...args] = tokenize(raw);
      const handler = handlers[cmd];
      if (!handler) {
        printLine(`Command not found: ${cmd}`, "error");
        return;
      }
      try {
        const result = handler(args);
        if (Array.isArray(result)) {
          result.forEach(line => printLine(line));
        }
      } catch (error) {
        printLine(error.message || String(error), "error");
      }
    }

    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        executeCommand(input.value);
        input.value = "";
        return;
      }
      if (event.key === "ArrowUp") {
        if (!state.history.length) {
          return;
        }
        event.preventDefault();
        state.index = Math.max(0, state.index - 1);
        input.value = state.history[state.index] || "";
        setTimeout(() => input.setSelectionRange(input.value.length, input.value.length), 0);
        return;
      }
      if (event.key === "ArrowDown") {
        if (!state.history.length) {
          return;
        }
        event.preventDefault();
        state.index = Math.min(state.history.length, state.index + 1);
        if (state.index === state.history.length) {
          input.value = "";
        } else {
          input.value = state.history[state.index] || "";
        }
        setTimeout(() => input.setSelectionRange(input.value.length, input.value.length), 0);
      }
    });

    shell.content.addEventListener("mousedown", () => input.focus());
    shell.window.addEventListener("app:activate", () => {
      updatePrompt();
      input.focus();
    });

    updatePrompt();
    printLine("Ubuntu Web Terminal (simulated)");
    printLine("Type 'help' to list commands.");
    input.focus();

    return shell.window;
  }

  function renderNotes() {
    const shell = createWindowShell("notes", "Notes", "notes");
    attachWindowControls(shell.window, "notes");
    shell.content.innerHTML = `
      <div class="notes-board" id="notes-board"></div>
      <button class="add-note" id="add-note">New Note</button>
    `;

    const board = shell.content.querySelector("#notes-board");
    const addButton = shell.content.querySelector("#add-note");

    function loadNotes() {
      const raw = localStorage.getItem("ubuntu-web-notes");
      return raw ? JSON.parse(raw) : [];
    }

    function saveNotes(notes) {
      localStorage.setItem("ubuntu-web-notes", JSON.stringify(notes));
    }

    function render() {
      board.innerHTML = "";
      const notes = loadNotes();
      notes.forEach((text, idx) => {
        const noteEl = document.createElement("div");
        noteEl.className = "note";
        noteEl.innerHTML = `
          <textarea>${text}</textarea>
          <button title="Delete">&times;</button>
        `;
        const textarea = noteEl.querySelector("textarea");
        const deleteBtn = noteEl.querySelector("button");
        textarea.addEventListener("input", () => {
          const current = loadNotes();
          current[idx] = textarea.value;
          saveNotes(current);
        });
        deleteBtn.addEventListener("click", () => {
          const current = loadNotes();
          current.splice(idx, 1);
          saveNotes(current);
          render();
        });
        board.appendChild(noteEl);
      });
    }

    addButton.addEventListener("click", () => {
      const notes = loadNotes();
      notes.push("New note");
      saveNotes(notes);
      render();
    });

    render();
    return shell.window;
  }

  function renderFiles(options = {}) {
    const startPath = options.path && vfs.directoryExists(options.path) ? options.path : "/home/ubuntu";
    const shell = createWindowShell("files", "Files", "files");
    const fsChangeHandler = () => {
      if (!document.body.contains(shell.window)) {
        document.removeEventListener("filesystem:changed", fsChangeHandler);
        return;
      }
      updateView(false);
    };

    attachWindowControls(shell.window, "files", {
      onClose: () => document.removeEventListener("filesystem:changed", fsChangeHandler)
    });

    shell.content.innerHTML = `
      <div class="files-header">
        <div class="files-nav">
          <button class="files-btn back-button" title="Back">&#8592;</button>
          <button class="files-btn forward-button" title="Forward">&#8594;</button>
          <button class="files-btn up-button" title="Up">&#8593;</button>
        </div>
        <div class="files-path"></div>
        <div class="files-actions">
          <button class="files-btn new-folder">New Folder</button>
          <button class="files-btn new-file">New Text File</button>
        </div>
      </div>
      <div class="file-list"></div>
    `;

    const pathLabel = shell.content.querySelector(".files-path");
    const listEl = shell.content.querySelector(".file-list");
    const backBtn = shell.content.querySelector(".back-button");
    const forwardBtn = shell.content.querySelector(".forward-button");
    const upBtn = shell.content.querySelector(".up-button");
    const newFolderBtn = shell.content.querySelector(".new-folder");
    const newFileBtn = shell.content.querySelector(".new-file");

    const history = {
      stack: [startPath],
      index: 0
    };

    function currentPath() {
      return history.stack[history.index];
    }

    function updateNavButtons() {
      backBtn.disabled = history.index <= 0;
      forwardBtn.disabled = history.index >= history.stack.length - 1;
      upBtn.disabled = currentPath() === "/";
    }

    function updatePathLabel() {
      const path = currentPath();
      if (path === "/") {
        pathLabel.textContent = "Filesystem";
        return;
      }
      const segments = path.split("/").filter(Boolean).map(segment => {
        if (segment === "home") {
          return "Home";
        }
        if (segment === "ubuntu") {
          return "ubuntu";
        }
        return segment;
      });
      pathLabel.textContent = segments.join(" / ");
    }

    function renderDirectory() {
      let entries = [];
      try {
        entries = vfs.list(currentPath());
      } catch (error) {
        showNotification(error.message);
        return;
      }
      listEl.innerHTML = "";
      if (!entries.length) {
        const empty = document.createElement("div");
        empty.className = "file-empty";
        empty.textContent = "This folder is empty.";
        listEl.appendChild(empty);
        return;
      }
      entries.forEach(entry => {
        const card = document.createElement("div");
        card.className = "file-card";
        card.dataset.path = entry.path;
        card.dataset.type = entry.type;
        card.innerHTML = `
          <div class="file-icon">${entry.type === "directory" ? "&#128193;" : "&#128196;"}</div>
          <strong>${entry.name}</strong>
          <span>${entry.type === "directory" ? "Folder" : "File"}</span>
        `;
        listEl.appendChild(card);
      });
    }

    function navigateTo(path, pushToHistory = true) {
      const resolved = vfs.directoryExists(path) ? path : vfs.resolve(path, currentPath());
      if (!vfs.directoryExists(resolved)) {
        showNotification(`Cannot open ${path}`);
        return;
      }
      if (pushToHistory) {
        history.stack = history.stack.slice(0, history.index + 1);
        history.stack.push(resolved);
        history.index += 1;
      }
      updateView(false);
    }

    function updateView(updateHistoryIndex = false) {
      if (updateHistoryIndex) {
        history.index = Math.max(0, history.stack.length - 1);
      }
      updateNavButtons();
      updatePathLabel();
      renderDirectory();
    }

    backBtn.addEventListener("click", () => {
      if (history.index <= 0) {
        return;
      }
      history.index -= 1;
      updateNavButtons();
      updatePathLabel();
      renderDirectory();
    });

    forwardBtn.addEventListener("click", () => {
      if (history.index >= history.stack.length - 1) {
        return;
      }
      history.index += 1;
      updateNavButtons();
      updatePathLabel();
      renderDirectory();
    });

    upBtn.addEventListener("click", () => {
      const path = currentPath();
      if (path === "/") {
        return;
      }
      const segments = path.split("/").filter(Boolean);
      segments.pop();
      const parent = segments.length ? `/${segments.join("/")}` : "/";
      navigateTo(parent);
    });

    listEl.addEventListener("dblclick", event => {
      const card = event.target.closest(".file-card");
      if (!card) {
        return;
      }
      const targetPath = card.dataset.path;
      const type = card.dataset.type;
      if (type === "directory") {
        navigateTo(targetPath);
      } else if (isTextFile(targetPath)) {
        openTextFile(targetPath);
      } else {
        try {
          const preview = vfs.readFile(targetPath);
          showNotification(`${basename(targetPath)}\n\n${preview.slice(0, 96)}${preview.length > 96 ? "..." : ""}`);
        } catch (error) {
          showNotification(error.message);
        }
      }
    });

    newFolderBtn.addEventListener("click", () => {
      const name = prompt("Folder name", "New Folder");
      if (!name) {
        return;
      }
      try {
        vfs.makeDir(name, currentPath());
        notifyFilesystemChange(currentPath());
        updateView(false);
      } catch (error) {
        showNotification(error.message);
      }
    });

    newFileBtn.addEventListener("click", () => {
      const name = prompt("File name", "New Document.txt");
      if (!name) {
        return;
      }
      try {
        const resolved = vfs.touch(name, currentPath());
        vfs.writeFile(resolved, "");
        notifyFilesystemChange(currentPath());
        updateView(false);
        openTextFile(resolved);
      } catch (error) {
        showNotification(error.message);
      }
    });

    document.addEventListener("filesystem:changed", fsChangeHandler);
    updateView(false);

    return shell.window;
  }

  function renderEditor(options = {}) {
    const shell = createWindowShell("editor", "Text Editor", "editor");
    attachWindowControls(shell.window, "editor", {
      onClose: () => {
        if (editorState && editorState.window === shell.window) {
          editorState = null;
        }
      }
    });

    shell.content.classList.add("editor");
    shell.content.innerHTML = `
      <div class="editor-toolbar">
        <span class="editor-file-label">Unsaved document</span>
        <div class="editor-buttons">
          <button data-action="open">Open...</button>
          <button data-action="save">Save</button>
          <button data-action="save-as">Save As...</button>
        </div>
      </div>
      <textarea class="editor-textarea" spellcheck="false"></textarea>
      <div class="editor-status"></div>
    `;

    const textarea = shell.content.querySelector(".editor-textarea");
    const status = shell.content.querySelector(".editor-status");
    const fileLabel = shell.content.querySelector(".editor-file-label");
    const buttons = shell.content.querySelectorAll(".editor-buttons button");

    editorState = {
      window: shell.window,
      textarea,
      status,
      fileLabel,
      currentPath: null
    };

    function setStatus(message) {
      status.textContent = message;
    }

    function setCurrentFile(path) {
      editorState.currentPath = path;
      if (path) {
        fileLabel.textContent = normalizePromptPath(path);
      } else {
        fileLabel.textContent = "Unsaved document";
      }
    }

    function loadFile(path) {
      try {
        const content = vfs.readFile(path);
        textarea.value = content;
        setCurrentFile(path);
        setStatus(`Loaded ${normalizePromptPath(path)}`);
      } catch (error) {
        setStatus(error.message);
      }
    }

    function saveCurrent() {
      if (editorState.currentPath) {
        try {
          vfs.writeFile(editorState.currentPath, textarea.value);
          notifyFilesystemChange(editorState.currentPath);
          setStatus(`Saved ${normalizePromptPath(editorState.currentPath)}`);
        } catch (error) {
          setStatus(error.message);
        }
      } else {
        saveAs();
      }
    }

    function saveAs() {
      const suggestion = editorState.currentPath ? normalizePromptPath(editorState.currentPath) : "~/Documents/notes.txt";
      const input = prompt("Save file as (absolute or relative path):", suggestion);
      const expanded = expandUserPath(input);
      if (!expanded) {
        setStatus("Save cancelled.");
        return;
      }
      try {
        const resolved = vfs.resolve(expanded, editorState.currentPath ? dirname(editorState.currentPath) : "/home/ubuntu");
        vfs.writeFile(resolved, textarea.value);
        notifyFilesystemChange(resolved);
        setCurrentFile(resolved);
        setStatus(`Saved ${normalizePromptPath(resolved)}`);
      } catch (error) {
        setStatus(error.message);
      }
    }

    function openFileDialog() {
      const suggestion = normalizePromptPath(editorState.currentPath || "/home/ubuntu/Documents/");
      const input = prompt("Open file (absolute or relative path):", suggestion);
      const expanded = expandUserPath(input);
      if (!expanded) {
        setStatus("Open cancelled.");
        return;
      }
      const resolved = vfs.resolve(expanded, editorState.currentPath ? dirname(editorState.currentPath) : "/home/ubuntu");
      if (!vfs.fileExists(resolved)) {
        setStatus("File not found.");
        return;
      }
      if (!isTextFile(resolved)) {
        setStatus("Only plain text files are supported.");
        return;
      }
      loadFile(resolved);
    }

    buttons.forEach(button => {
      const action = button.dataset.action;
      if (action === "open") {
        button.addEventListener("click", openFileDialog);
      }
      if (action === "save") {
        button.addEventListener("click", saveCurrent);
      }
      if (action === "save-as") {
        button.addEventListener("click", saveAs);
      }
    });

    textarea.addEventListener("input", () => {
      if (!editorState.currentPath) {
        localStorage.setItem("ubuntu-web-editor-unsaved", textarea.value);
      }
      setStatus("Unsaved changes");
    });

    shell.window.addEventListener("app:activate", event => {
      const detail = event.detail || {};
      if (detail.filePath) {
        loadFile(detail.filePath);
      }
      textarea.focus();
    });

    if (options.filePath) {
      loadFile(options.filePath);
    } else {
      const stored = localStorage.getItem("ubuntu-web-editor-unsaved");
      if (stored) {
        textarea.value = stored;
        setStatus("Recovered unsaved document from previous session.");
      } else {
        textarea.value = "# Notes\n\nStart typing...";
        setStatus("Ready.");
      }
    }

    textarea.focus();
    return shell.window;
  }

  function renderBrowser() {
    const shell = createWindowShell("browser", "Web Browser", "browser");
    attachWindowControls(shell.window, "browser");

    shell.content.innerHTML = `
      <div class="browser-frame">
        <div class="browser-bar">
          <input type="text" class="browser-address" value="about:ubuntu">
          <button class="browser-go">Go</button>
        </div>
        <div class="browser-content"></div>
      </div>
    `;

    const addressInput = shell.content.querySelector(".browser-address");
    const goButton = shell.content.querySelector(".browser-go");
    const browserContent = shell.content.querySelector(".browser-content");

    function renderHomepage() {
      browserContent.innerHTML = `
        <div class="browser-home">
          <div class="browser-home-header">
            <h1>Ubuntu Web</h1>
            <p>Search the web or pick a shortcut to begin exploring.</p>
          </div>
          <form class="browser-search">
            <input type="text" name="q" placeholder="Search the web (opens new tab)">
            <button type="submit">Search</button>
          </form>
          <div class="browser-shortcuts">
            ${HOMEPAGE_SHORTCUTS.map(shortcut => `
              <button class="shortcut" data-url="${shortcut.url}">${shortcut.label}</button>
            `).join("")}
          </div>
        </div>
      `;
      const searchForm = browserContent.querySelector(".browser-search");
      const shortcuts = browserContent.querySelectorAll(".shortcut");
      searchForm.addEventListener("submit", event => {
        event.preventDefault();
        const data = new FormData(searchForm);
        const query = (data.get("q") || "").toString().trim();
        if (!query) {
          return;
        }
        const targetUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
        window.open(targetUrl, "_blank", "noopener");
        browserContent.innerHTML = `
          <div class="browser-notice">
            <p>Search results opened in a new tab.</p>
          </div>
        `;
      });
      shortcuts.forEach(button => {
        button.addEventListener("click", () => {
          const url = button.dataset.url;
          window.open(url, "_blank", "noopener");
          browserContent.innerHTML = `
            <div class="browser-notice">
              <p>Opened <strong>${url}</strong> in a new tab.</p>
            </div>
          `;
        });
      });
    }

    function renderInternal(url) {
      const page = INTERNAL_BROWSER_PAGES[url];
      if (!page) {
        browserContent.innerHTML = `
          <div class="browser-notice">
            <h2>Page not found</h2>
            <p>The internal page <code>${url}</code> does not exist.</p>
          </div>
        `;
        return;
      }
      browserContent.innerHTML = `
        <div class="browser-internal">
          <h1>${page.title}</h1>
          <div>${page.body}</div>
        </div>
      `;
    }

    function renderExternalNotice(url) {
      browserContent.innerHTML = `
        <div class="browser-notice">
          <h2>Opened in new tab</h2>
          <p>The URL <code>${url}</code> has been opened outside of this sandboxed browser.</p>
        </div>
      `;
    }

    function loadPage(url) {
      const trimmed = url.trim();
      if (!trimmed) {
        return;
      }
      addressInput.value = trimmed;
      if (trimmed === "about:home" || trimmed === "about:ubuntu") {
        renderHomepage();
        return;
      }
      if (trimmed.startsWith("about:")) {
        renderInternal(trimmed);
        return;
      }
      if (/^https?:\/\//i.test(trimmed)) {
        window.open(trimmed, "_blank", "noopener");
        renderExternalNotice(trimmed);
        return;
      }
      const assumed = `https://${trimmed}`;
      window.open(assumed, "_blank", "noopener");
      renderExternalNotice(assumed);
    }

    goButton.addEventListener("click", () => loadPage(addressInput.value));
    addressInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        loadPage(addressInput.value);
      }
    });

    renderHomepage();
    return shell.window;
  }

  function renderSettings() {
    const shell = createWindowShell("settings", "Settings", "settings");
    attachWindowControls(shell.window, "settings");

    shell.content.innerHTML = `
      <div class="settings-panel">
        <div class="settings-section">
          <h4>Background</h4>
          <div class="wallpaper-grid">
            <div class="wallpaper-thumb" data-wallpaper="a" style="background-image: linear-gradient(150deg, #22011a, #421c44 55%, #0f1f35);"></div>
            <div class="wallpaper-thumb" data-wallpaper="b" style="background-image: linear-gradient(160deg, #041a2d, #053559 60%, #02121f);"></div>
            <div class="wallpaper-thumb" data-wallpaper="c" style="background-image: linear-gradient(160deg, #2b0b0b, #631515 60%, #2c080d);"></div>
            <div class="wallpaper-thumb" data-wallpaper="d" style="background-image: linear-gradient(160deg, #021f1f, #043b3b 60%, #010b17);"></div>
          </div>
        </div>
        <div class="settings-section">
          <h4>Accent Colour</h4>
          <div class="accent-grid">
            ${Object.entries(ACCENT_THEMES).map(([key, theme]) => `
              <button class="accent-option" data-accent="${key}">
                <span class="accent-swatch" style="background: linear-gradient(135deg, ${theme.primary}, ${theme.secondary});"></span>
                <span>${theme.name}</span>
              </button>
            `).join("")}
          </div>
        </div>
        <div class="settings-section">
          <h4>System</h4>
          <label class="toggle">
            <input type="checkbox" id="clock-format-toggle">
            <span>Use 24-hour clock</span>
          </label>
          <p>Device Name: ubuntu-web</p>
          <p>OS Version: Ubuntu Web Desktop 22.04</p>
          <p>Processor: JavaScript simulated</p>
          <p>Memory: Virtual</p>
        </div>
      </div>
    `;

    const wallpaperThumbs = shell.content.querySelectorAll(".wallpaper-thumb");
    const accentButtons = shell.content.querySelectorAll(".accent-option");
    const clockToggle = shell.content.querySelector("#clock-format-toggle");

    wallpaperThumbs.forEach(thumb => {
      const key = thumb.dataset.wallpaper;
      if (key === userSettings.wallpaper) {
        thumb.classList.add("active");
      }
      thumb.addEventListener("click", () => {
        wallpaperThumbs.forEach(item => item.classList.remove("active"));
        thumb.classList.add("active");
        setWallpaper(key);
        showNotification("Wallpaper updated.");
      });
    });

    accentButtons.forEach(button => {
      const accent = button.dataset.accent;
      if (accent === userSettings.accent) {
        button.classList.add("active");
      }
      button.addEventListener("click", () => {
        accentButtons.forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");
        applyAccentTheme(accent);
        showNotification("Accent colour updated.");
      });
    });

    clockToggle.checked = userSettings.clock24hr;
    clockToggle.addEventListener("change", () => {
      setClockPreference(clockToggle.checked);
      showNotification(`Clock format set to ${clockToggle.checked ? "24-hour" : "12-hour"}.`);
    });

    return shell.window;
  }

  const APP_HANDLERS = {
    terminal: renderTerminal,
    files: renderFiles,
    editor: renderEditor,
    browser: renderBrowser,
    settings: renderSettings,
    notes: renderNotes
  };

  function launchApp(appId, options = {}) {
    ensureIconCache();
    const handler = APP_HANDLERS[appId];
    if (!handler) {
      showNotification(`Application "${appId}" is not available.`);
      return null;
    }
    const existing = openWindows.get(appId);
    if (existing && document.body.contains(existing)) {
      focusWindow(existing);
      existing.style.display = "flex";
      existing.classList.remove("minimized");
      if (Object.keys(options).length > 0) {
        existing.dispatchEvent(new CustomEvent("app:activate", { detail: options }));
      }
      return existing;
    }
    const win = handler(options);
    if (win) {
      openWindows.set(appId, win);
      icons[appId]?.classList.add("active");
      if (Object.keys(options).length > 0) {
        win.dispatchEvent(new CustomEvent("app:activate", { detail: options }));
      }
    }
    return win;
  }

  function bindDock() {
    dock.querySelectorAll(".dock-item").forEach(btn => {
      btn.addEventListener("click", () => launchApp(btn.dataset.app));
    });
  }

  function bindAppGrid() {
    const toggle = document.getElementById("app-grid-toggle");
    const close = document.getElementById("app-grid-close");
    const activities = document.getElementById("activities-button");

    function showGrid() {
      appGrid.classList.add("active");
    }

    function hideGrid() {
      appGrid.classList.remove("active");
    }

    toggle.addEventListener("click", () => {
      if (appGrid.classList.contains("active")) {
        hideGrid();
      } else {
        showGrid();
      }
    });

    activities.addEventListener("click", () => {
      showGrid();
      showNotification("Activities overview (simulated)");
    });

    close.addEventListener("click", hideGrid);

    appGrid.addEventListener("click", event => {
      const target = event.target.closest("[data-app]");
      if (!target) {
        return;
      }
      hideGrid();
      launchApp(target.dataset.app);
    });
  }

  function bindFullscreen() {
    fullscreenToggle.addEventListener("click", toggleFullscreen);
    document.addEventListener("fullscreenchange", () => {
      fullscreenToggle.classList.toggle("active", !!document.fullscreenElement);
    });
  }

  function bindLogin() {
    const loginForm = document.getElementById("login-form");
    const passwordInput = document.getElementById("login-password");

    loginForm.addEventListener("submit", event => {
      event.preventDefault();
      if (passwordInput.value.trim() === "password") {
        loginScreen.classList.remove("active");
        applyAccentTheme(userSettings.accent);
        setWallpaper(userSettings.wallpaper);
        desktop.classList.add("active");
        showNotification("Welcome to Ubuntu Web Desktop!");
        updateClock();
        if (clockTimer) {
          clearInterval(clockTimer);
        }
        clockTimer = setInterval(updateClock, 20000);
        launchApp("files");
        launchApp("terminal");
      } else {
        passwordInput.value = "";
        showNotification("Incorrect password. Try 'password'.");
      }
    });
  }

  function init() {
    applyAccentTheme(userSettings.accent);
    startSequence();
    bindLogin();
    bindDock();
    bindAppGrid();
    bindFullscreen();
    updateClock();
    setInterval(updateClock, 60000);
  }

  document.addEventListener("DOMContentLoaded", init);

})();
