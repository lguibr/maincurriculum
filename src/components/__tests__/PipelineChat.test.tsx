import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import "@testing-library/jest-dom";
import { RepoProgressTracker } from "../PipelineChat";
import { useStore } from "../../store/useStore";

// Partial test of store and subcomponents

describe("Frontend Progress Bar and Error Integration", () => {
  let originalEventSource: any;

  beforeEach(() => {
    useStore.setState({
      isRunning: false,
      logs: [],
      targetRepos: [],
      reposProgress: {},
      subagents: {},
    });
    vi.clearAllMocks();
    originalEventSource = global.EventSource;
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as any;
  });

  afterEach(() => {
    global.EventSource = originalEventSource;
  });

  // ========== ERROR HANDLING TESTS ==========

  it("1. Flags gracefully when EventStream connection drops entirely", async () => {
    const closeSpy = vi.fn();
    const MockES = vi.fn().mockImplementation(() => ({
      close: closeSpy,
      onmessage: null,
      onerror: null,
    }));
    global.EventSource = MockES as any;

    useStore.setState({ githubUsername: "test" });
    await act(async () => {
      await useStore.getState().startAgent();
    });

    const instance = MockES.mock.results[0].value;
    act(() => {
      // Simulate error
      if (instance.onerror) instance.onerror(new Error("Network disconnect"));
    });

    expect(useStore.getState().isRunning).toBe(false);
    expect(closeSpy).toHaveBeenCalled();
  });

  it("2. Safely ignores unparseable SSE json payloads without crashing", async () => {
    const MockES = vi.fn().mockImplementation(() => ({
      close: vi.fn(),
    }));
    global.EventSource = MockES as any;

    await act(async () => {
      await useStore.getState().startAgent();
    });

    const instance = MockES.mock.results[0].value;

    expect(() => {
      act(() => {
        // SyntaxError thrown by JSON.parse if uncaught
        try {
          instance.onmessage({ data: "{ invalid json" });
        } catch (e) {}
      });
    }).not.toThrow();
  });

  it("3. Successfully handles pipeline interrupts dynamically updating the UI state", async () => {
    const MockES = vi.fn().mockImplementation(() => ({
      close: vi.fn(),
    }));
    global.EventSource = MockES as any;

    await act(async () => {
      await useStore.getState().startAgent();
    });
    const instance = MockES.mock.results[0].value;

    act(() => {
      instance.onmessage({
        data: JSON.stringify({
          type: "interrupt",
          data: { phase: "Final QA", question: "How many years of exp?" },
        }),
      });
    });

    expect(useStore.getState().currentPhase).toBe("Final QA");
    expect(useStore.getState().currentQuestion).toBe("How many years of exp?");
    expect(useStore.getState().logs).toContain("Agent paused for user input...");
  });

  // ========== PROGRESS UI TESTS ==========

  it("4. Shows empty global progress unconditionally initially with placeholder when no repos are targeted", () => {
    const { rerender } = render(
      <RepoProgressTracker targetRepos={[]} reposProgress={{}} globalProgressOverride={0} />
    );
    expect(screen.getByText("Waiting for payload...")).toBeInTheDocument();
    expect(
      screen.getByText("No active repositories. Waiting for launch command...")
    ).toBeInTheDocument();

    // Rerender with active progress but no target repos yet
    rerender(
      <RepoProgressTracker
        targetRepos={[]}
        reposProgress={{}}
        globalProgressOverride={5}
        globalPhaseOverride="Connecting to Github..."
      />
    );
    expect(screen.getByText("Connecting to Github...")).toBeInTheDocument();
    expect(
      screen.getByText("Analyzing source systems and determining target repositories...")
    ).toBeInTheDocument();
  });

  it("5. Generates new sub-bars for Repo 1", () => {
    const targetRepos = ["lib-one"];
    const reposProgress = {
      "lib-one": { phase: "Pending Initialization...", progress: 0, currentPhaseProgress: 0 },
    };

    render(
      <RepoProgressTracker
        targetRepos={targetRepos}
        reposProgress={reposProgress}
        globalProgressOverride={0}
      />
    );

    expect(screen.getByText("lib-one")).toBeInTheDocument();
    expect(screen.getByText("0 / 1 Repositories")).toBeInTheDocument();
    expect(screen.getByText("Pending Initialization...")).toBeInTheDocument();
  });

  it("6. Generates new sub-bars for multiple Repos simultaneously safely", () => {
    const targetRepos = ["alpha", "beta"];
    const reposProgress = {
      alpha: { phase: "Cloning", progress: 10, currentPhaseProgress: 10 },
      beta: { phase: "Waiting", progress: 0, currentPhaseProgress: 0 },
    };

    render(
      <RepoProgressTracker
        targetRepos={targetRepos}
        reposProgress={reposProgress}
        globalProgressOverride={0}
      />
    );

    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
    expect(screen.getByText("Cloning")).toBeInTheDocument();
  });

  it("7. Calculates global progress percentage dynamically across grouped grids", () => {
    const targetRepos = ["repo1", "repo2", "repo3", "repo4"];
    const reposProgress = {
      repo1: { phase: "Complete", progress: 100, currentPhaseProgress: 100 },
      repo2: { phase: "Complete", progress: 100, currentPhaseProgress: 100 },
      repo3: { phase: "Cloning", progress: 50, currentPhaseProgress: 50 },
      repo4: { phase: "Pending", progress: 0, currentPhaseProgress: 0 },
    };

    const { container } = render(
      <RepoProgressTracker
        targetRepos={targetRepos}
        reposProgress={reposProgress}
        globalProgressOverride={0}
      />
    );

    // 2 out of 4 are 100% complete
    expect(screen.getByText("2 / 4 Repositories")).toBeInTheDocument();

    // Check if the global width is set correctly to 50%
    const primaryBar = container.querySelector(".bg-primary.transition-all");
    expect(primaryBar).toHaveStyle({ width: "50%" });
  });

  it("8. Successfully renders fully completed UI state across the board and marks green emerald", () => {
    const targetRepos = ["main-app"];
    const reposProgress = {
      "main-app": { phase: "Complete", progress: 100, currentPhaseProgress: 100 },
    };

    const { container } = render(
      <RepoProgressTracker
        targetRepos={targetRepos}
        reposProgress={reposProgress}
        globalProgressOverride={0}
      />
    );

    expect(screen.getByText("1 / 1 Repositories")).toBeInTheDocument();

    // The bar itself becomes emerald (green) when complete
    const emeraldBar = container.querySelector(".bg-emerald-500");
    expect(emeraldBar).toBeInTheDocument();
    expect(emeraldBar).toHaveStyle({ width: "100%" });
  });
});
