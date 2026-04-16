#!/bin/bash
# =============================================================================
# Auto-Retry Uninstaller for Antigravity IDE
# =============================================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

echo ""
echo -e "${CYAN}  ╔═══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}  ║   ⚡ Auto-Retry for Antigravity IDE           ║${NC}"
echo -e "${CYAN}  ║   Uninstaller                                 ║${NC}"
echo -e "${CYAN}  ╚═══════════════════════════════════════════════╝${NC}"
echo ""

# ── Auto-detect ──────────────────────────────────────────────────────────────
detect_workbench() {
    local search_paths=(
        "/Applications/Antigravity.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html"
        "$HOME/Applications/Antigravity.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html"
        "/opt/Antigravity/resources/app/out/vs/code/electron-browser/workbench/workbench.html"
        "/usr/share/antigravity/resources/app/out/vs/code/electron-browser/workbench/workbench.html"
        "/snap/antigravity/current/usr/share/antigravity/resources/app/out/vs/code/electron-browser/workbench/workbench.html"
    )

    for path in "${search_paths[@]}"; do
        if [ -f "$path" ]; then
            echo "$path"
            return 0
        fi
    done

    local found
    found=$(find /opt /usr/share /snap "$HOME" -maxdepth 6 -name "workbench.html" -path "*/antigravity*" -path "*/electron-browser/*" 2>/dev/null | head -1)
    if [ -n "$found" ]; then
        echo "$found"
        return 0
    fi

    return 1
}

WORKBENCH_HTML="${1:-$(detect_workbench 2>/dev/null || echo "")}"
BACKUP_FILE="$WORKBENCH_HTML.backup"

if [ -z "$WORKBENCH_HTML" ]; then
    echo -e "${RED}❌ Could not find Antigravity IDE installation.${NC}"
    echo -e "   Provide path manually: ${CYAN}./uninstall.sh /path/to/workbench.html${NC}"
    exit 1
fi

# ── Check permissions ────────────────────────────────────────────────────────
if [ ! -w "$WORKBENCH_HTML" ] 2>/dev/null; then
    exec sudo "$0" "$@"
fi

# ── Restore backup ──────────────────────────────────────────────────────────
if [ -f "$BACKUP_FILE" ]; then
    cp "$BACKUP_FILE" "$WORKBENCH_HTML"
    echo -e "  ${GREEN}✅ workbench.html restored from backup.${NC}"
    
    # Clean up auto-retry.js from workbench dir
    WORKBENCH_DIR=$(dirname "$WORKBENCH_HTML")
    rm -f "$WORKBENCH_DIR/auto-retry.js"
    
    echo ""
    echo -e "  ${YELLOW}Restart Antigravity IDE to complete uninstall.${NC}"
    echo ""
else
    echo -e "${RED}❌ No backup file found.${NC}"
    echo -e "   Backup expected at: $BACKUP_FILE"
    echo -e "   You may need to reinstall Antigravity IDE."
fi
