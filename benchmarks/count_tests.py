# benchmarks/count_tests.py
# Runs the test suite and prints a pass/fail count + resume-ready line.
# Usage: python benchmarks/count_tests.py

import re
import subprocess
import sys
import time
from pathlib import Path

ROOT     = Path(__file__).parent.parent
TEST_DIR = ROOT / "tests"

print("\nTest Coverage Count")
print("=" * 55)
print("Running: pytest tests/ -v --tb=no -q\n")

t0 = time.perf_counter()
result = subprocess.run(
    [sys.executable, "-m", "pytest", str(TEST_DIR), "-v", "--tb=no", "-q", "--no-header"],
    capture_output=True,
    text=True,
    encoding="utf-8",
    errors="replace",
    cwd=str(ROOT),
)
elapsed = time.perf_counter() - t0

if result.stdout.strip():
    print(result.stdout)

passed = failed = skipped = errors = 0
for line in result.stdout.splitlines():
    if "passed" in line or "failed" in line or "error" in line:
        m = re.search(r"(\d+) passed",  line); passed  = int(m.group(1)) if m else passed
        m = re.search(r"(\d+) failed",  line); failed  = int(m.group(1)) if m else failed
        m = re.search(r"(\d+) skipped", line); skipped = int(m.group(1)) if m else skipped
        m = re.search(r"(\d+) error",   line); errors  = int(m.group(1)) if m else errors

print("-" * 55)
print("  Passed  : %d" % passed)
if failed:  print("  Failed  : %d" % failed)
if skipped: print("  Skipped : %d" % skipped)
if errors:  print("  Errors  : %d" % errors)
print("  Total   : %d" % (passed + failed + skipped + errors))
print("  Time    : %.2fs" % elapsed)

print("\n" + "=" * 55)
if passed and failed == 0 and errors == 0:
    print("  RESUME LINE:")
    print('  "%d unit & integration tests covering all 4 tool backends"' % passed)
elif passed:
    print("  RESUME LINE (partial):")
    print('  "%d tests passing; %d need attention"' % (passed, failed + errors))
else:
    print("  No tests passed -- check your environment.")
print("=" * 55)

sys.exit(result.returncode)
