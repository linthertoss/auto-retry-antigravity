"""
Auto-Retry Injector for Antigravity IDE
Modifies workbench.html to load auto-retry.js
Handles CSP and trusted-types fixes
"""
import os
import shutil
import sys


def main():
    workbench_path = os.environ.get('WORKBENCH_HTML', '')
    js_src = os.environ.get('AUTO_RETRY_JS', '')

    if not workbench_path:
        print('  ❌ WORKBENCH_HTML env var not set')
        sys.exit(1)
    if not js_src:
        print('  ❌ AUTO_RETRY_JS env var not set')
        sys.exit(1)

    workbench_dir = os.path.dirname(workbench_path)
    js_dest = os.path.join(workbench_dir, 'auto-retry.js')

    # Step 1: Copy auto-retry.js into workbench directory
    shutil.copy2(js_src, js_dest)
    print('  ✓ Copied auto-retry.js')

    # Step 2: Read workbench.html
    with open(workbench_path, 'r', encoding='utf-8') as f:
        html = f.read()

    # Step 3: Add 'unsafe-inline' to script-src CSP
    if 'script-src' in html:
        script_section = html.split('script-src')[1].split(';')[0]
        if "'unsafe-inline'" not in script_section:
            html = html.replace(
                "script-src\n\t\t\t\t\t'self'",
                "script-src\n\t\t\t\t\t'self'\n\t\t\t\t\t'unsafe-inline'"
            )
            print('  ✓ Fixed CSP: added unsafe-inline')

    # Step 4: Add default trusted type policy
    if 'trusted-types' in html and "'allow-duplicates'" not in html:
        # Try to find the last policy entry before the semicolon
        if "google#safe\n\t\t\t\t;" in html:
            html = html.replace(
                "google#safe\n\t\t\t\t;",
                "google#safe\n\t\t\t\t\tdefault\n\t\t\t\t\t'allow-duplicates'\n\t\t\t\t;"
            )
            print('  ✓ Fixed CSP: added trusted types policy')

    # Step 5: Inject script tag before </html>
    injection = '\n'.join([
        '<!-- AUTO-RETRY-INJECTED -->',
        '<script src="./auto-retry.js"></script>',
    ])

    if '</html>' in html:
        html = html.replace('</html>', injection + '\n</html>')
    else:
        html += '\n' + injection

    # Step 6: Write back
    with open(workbench_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print('  ✓ Injected script tag')


if __name__ == '__main__':
    main()
