# benchmarks/bench_monte_carlo.py
# Runs Monte Carlo simulate() 100 times and prints median + p95 latency.
# Usage: python benchmarks/bench_monte_carlo.py

import statistics
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from compute.monte_carlo import simulate

RUNS        = 100
PRICE       = 162.45
VOLATILITY  = 0.35
DAYS        = 30
SIMULATIONS = 10_000

print("\nMonte Carlo Latency Benchmark - %d runs, %d paths each" % (RUNS, SIMULATIONS))
print("-" * 55)

timings = []
for i in range(1, RUNS + 1):
    t0 = time.perf_counter()
    result = simulate(current_price=PRICE, volatility=VOLATILITY,
                      days=DAYS, simulations=SIMULATIONS)
    timings.append((time.perf_counter() - t0) * 1000)
    if i % 10 == 0:
        print("  [%3d/%d]  %7.1f ms  engine=%s" % (i, RUNS, timings[-1], result.get("engine", "?")))

timings.sort()
median_ms = statistics.median(timings)
p95_ms    = timings[max(int(len(timings) * 0.95) - 1, 0)]
mean_ms   = statistics.mean(timings)

print("\n" + "=" * 55)
print("  Results (%d runs, 10,000 paths each)" % RUNS)
print("  Median : %8.1f ms  <- put this on your resume" % median_ms)
print("  p95    : %8.1f ms  <- worst-case tail" % p95_ms)
print("  Mean   : %8.1f ms" % mean_ms)
print("  Min    : %8.1f ms" % timings[0])
print("  Max    : %8.1f ms" % timings[-1])
print("=" * 55)
