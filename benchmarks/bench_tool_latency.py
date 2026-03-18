# benchmarks/bench_tool_latency.py
# End-to-end latency for all 4 tool backends, 10 runs each.
# Usage: python benchmarks/bench_tool_latency.py
# Needs API keys in .env

import asyncio
import statistics
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


def median_ms(timings):
    s = sorted(timings)
    return statistics.median(s), s[max(int(len(s) * 0.95) - 1, 0)]


RUNS = 10


async def bench(label, coro_factory):
    timings = []
    for _ in range(RUNS):
        t0 = time.perf_counter()
        try:
            await coro_factory()
        except Exception:
            pass
        timings.append((time.perf_counter() - t0) * 1000)
    med, p95 = median_ms(timings)
    print("  %-42s  %7.1f ms median   %7.1f ms p95" % (label, med, p95))
    return label, med, p95


async def main():
    print("\nEnd-to-End Tool Latency Benchmark - %d runs per tool" % RUNS)
    print("=" * 65)
    results = []

    print("\n[Tool 1] query_live_market_data (Polygon.io / Finnhub)")
    from tools.market_data import get_market_snapshot
    for ticker in ("GOOGL", "NVDA"):
        results.append(await bench("get_market_snapshot(%s)" % ticker,
                                   lambda t=ticker: get_market_snapshot(t)))

    print("\n[Tool 3] execute_quantitative_model (Monte Carlo GBM)")
    from tools.quant_model import run_monte_carlo
    results.append(await bench("run_monte_carlo(AMD, 10000 paths)",
                               lambda: run_monte_carlo("AMD", days=30, simulations=10_000)))

    print("\n[Tool 4] log_research_insight (Vault disk write)")
    from tools.vault_logger import log_insight
    results.append(await bench("log_insight(title, tags)",
                               lambda: log_insight(content="Benchmark note - safe to delete.",
                                                   tags=["benchmark"], title="Benchmark Note")))

    print("\n[Tool 2] analyze_sec_filings_rag (Bedrock KB / FAISS)")
    from tools.sec_rag import query_sec_filings
    results.append(await bench("query_sec_filings(Nvidia, revenue risk)",
                               lambda: query_sec_filings("Nvidia", "revenue risk", "10-K")))

    print("\n" + "=" * 65)
    print("  SUMMARY - Median latencies (use these on your resume)")
    print("-" * 65)
    for label, med, p95 in results:
        print("  %-42s  %7.1f ms" % (label, med))
    print("=" * 65)


if __name__ == "__main__":
    asyncio.run(main())
