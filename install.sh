#!/bin/bash
# =============================================================================
# Auto-Retry Installer for Antigravity IDE
# Automatically detects Antigravity installation path
# =============================================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AUTO_RETRY_JS="$SCRIPT_DIR/auto-retry.js"
MARKER="AUTO-RETRY-INJECTED"

echo ""
echo -e "${CYAN}  ╔═══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}  ║   ⚡ Auto-Retry for Antigravity IDE           ║${NC}"
echo -e "${CYAN}  ║   Installer v1.0                              ║${NC}"
echo -e "${CYAN}  ╚═══════════════════════════════════════════════╝${NC}"
echo ""

# ── Auto-detect Antigravity installation ──────────────────────────────────────
detect_workbench() {
    local search_paths=(
        "/Applications/Antigravity.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html"
        "$HOME/Applications/Antigravity.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html"
        "/opt/Antigravity/resources/app/out/vs/code/electron-browser/workbench/workbench.html"
        "/usr/share/antigravity/resources/app/out/vs/code/electron-browser/workbench/workbench.html"
        "/snap/antigravity/current/usr/share/antigravity/resources/app/out/vs/code/electron-browser/workbench/workbench.html"
    )

    # Also try to find via `which` or `find`
    for path in "${search_paths[@]}"; do
        if [ -f "$path" ]; then
            echo "$path"
            return 0
        fi
    done

    # Try finding on Linux
    local found
    found=$(find /opt /usr/share /snap "$HOME" -maxdepth 6 -name "workbench.html" -path "*/antigravity*" -path "*/electron-browser/*" 2>/dev/null | head -1)
    if [ -n "$found" ]; then
        echo "$found"
        return 0
    fi

    return 1
}

WORKBENCH_HTML=$(detect_workbench) || {
    echo -e "${RED}❌ Could not find Antigravity IDE installation.${NC}"
    echo ""
    echo "   Please provide the path to workbench.html manually:"
    echo -e "   ${YELLOW}./install.sh /path/to/Antigravity.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html${NC}"
    echo ""
    exit 1
}

# Allow manual override
if [ -n "$1" ]; then
    WORKBENCH_HTML="$1"
fi

WORKBENCH_DIR=$(dirname "$WORKBENCH_HTML")
BACKUP_FILE="$WORKBENCH_HTML.backup"

echo -e "  ${GREEN}✓${NC} Found Antigravity IDE at:"
echo -e "    ${BLUE}$WORKBENCH_DIR${NC}"
echo ""

# ── Pre-flight checks ────────────────────────────────────────────────────────
[ ! -f "$WORKBENCH_HTML" ] && echo -e "${RED}❌ workbench.html not found at: $WORKBENCH_HTML${NC}" && exit 1
[ ! -f "$AUTO_RETRY_JS" ] && echo -e "${RED}❌ auto-retry.js not found. Make sure you're running from the project directory.${NC}" && exit 1

if grep -q "$MARKER" "$WORKBENCH_HTML"; then
    echo -e "${YELLOW}⚠️  Auto-Retry is already installed.${NC}"
    echo -e "   Run ${CYAN}./uninstall.sh${NC} first, then reinstall."
    exit 0
fi

# ── Check write permissions ───────────────────────────────────────────────────
if [ ! -w "$WORKBENCH_HTML" ]; then
    echo -e "${YELLOW}⚠️  Need elevated permissions to modify workbench.html${NC}"
    echo -e "   Re-running with sudo..."
    echo ""
    exec sudo "$0" "$@"
fi

# ── Create backup ────────────────────────────────────────────────────────────
if [ ! -f "$BACKUP_FILE" ]; then
    cp "$WORKBENCH_HTML" "$BACKUP_FILE"
    echo -e "  ${GREEN}✓${NC} Backup created"
else
    echo -e "  ${YELLOW}ℹ${NC} Backup already exists"
fi

# ── Run injection ────────────────────────────────────────────────────────────
AUTO_RETRY_JS="$AUTO_RETRY_JS" WORKBENCH_HTML="$WORKBENCH_HTML" python3 "$SCRIPT_DIR/inject.py"

echo ""
echo -e "  ${GREEN}════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}  ✅ Auto-Retry installed successfully!${NC}"
echo -e "  ${GREEN}════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${YELLOW}Next steps:${NC}"
echo "    1. Quit Antigravity IDE completely (Cmd+Q / Ctrl+Q)"
echo "    2. Reopen Antigravity IDE"
echo "    3. Look for ⚡ indicator in the bottom-right corner"
echo ""
echo -e "  ${BLUE}Tip:${NC} Click the indicator to open the inspection panel"
echo -e "  ${BLUE}Tip:${NC} Double-click the indicator to toggle on/off"
echo ""
echo -e "  To uninstall: ${CYAN}./uninstall.sh${NC}"
echo ""
