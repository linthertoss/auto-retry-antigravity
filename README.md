# ⚡ Auto-Retry for Antigravity IDE

Never manually click "Retry" again. This script automatically detects and retries failed AI requests in [Antigravity IDE](https://antigravity.dev).

## Install (one command)

```bash
git clone https://github.com/linthertoss/auto-retry-antigravity.git && auto-retry-antigravity/install.sh
```

That's it. Restart Antigravity IDE and you're done.

> **Note:** If prompted for your password, it's because the installer needs write access to the IDE's app bundle.

---

## What It Does

Antigravity IDE sometimes fails AI requests. When that happens, a "Retry" button appears and you have to click it manually. This script watches for that button and **clicks it for you automatically**, with smart exponential backoff.

```
Request fails → Retry button appears → Script detects it → Auto-clicks → Done ✨
```

### Features

- 🔍 Auto-detects retry buttons (CSS selectors, text matching, icon detection)
- 🔄 Auto-clicks with exponential backoff (800ms → 1.2s → 1.8s → ...)
- 🛡️ Stops after 10 retries to prevent infinite loops
- 📊 Status indicator in bottom-right corner
- 🔧 Built-in inspector panel to fine-tune detection

## Usage

After install and restart, look for the **⚡ Auto-Retry: ON** indicator in the bottom-right corner.

| Indicator | Meaning |
|-----------|---------|
| 🟢 `⚡ Auto-Retry: ON` | Watching for retry buttons |
| 🟠 `🔄 Retrying...` | Currently retrying a failed request |
| 🔴 `⛔ Max retries` | Stopped after max attempts |
| 🟢 `✅ OK!` | Successfully retried |

**Click** the indicator → Opens inspector panel (shows all buttons on page)  
**Double-click** → Toggle auto-retry on/off

## Uninstall

```bash
auto-retry-antigravity/uninstall.sh
```

## After IDE Updates

When Antigravity updates, just re-run:

```bash
auto-retry-antigravity/install.sh
```

## Configuration

Edit `auto-retry.js` to customize behavior:

```javascript
var CONFIG = {
    maxRetries: 10,           // Max consecutive retries
    initialDelay: 800,        // ms before first retry
    maxDelay: 10000,          // Max delay cap
    backoffMultiplier: 1.5,   // Delay multiplier per retry
};
```

Then reinstall: `./uninstall.sh && ./install.sh`

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Installation corrupt" warning | Click ⚙️ → "Don't Show Again" |
| Indicator not showing | Fully quit IDE (`Cmd+Q`) and reopen |
| Retry button not detected | Click indicator → inspect panel → identify the button → add selector to `CONFIG.selectors` |
| Permission denied | Run with `sudo`: `sudo ./install.sh` |

## How It Works

| File | Purpose |
|------|---------|
| `auto-retry.js` | MutationObserver watches DOM, detects retry buttons, auto-clicks |
| `install.sh` | Finds IDE, backs up workbench.html, injects script |
| `uninstall.sh` | Restores workbench.html from backup |
| `inject.py` | Patches CSP headers + injects `<script>` tag |

## Contributing

PRs welcome! Ideas:
- Windows support
- More retry button patterns
- Success rate statistics
- Sound notification on retry

## License

[MIT](LICENSE)
# auto-retry-antigravity
