import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import React from "react";
import Onboarding from "../Onboarding";
import * as storeModule from "../../store/useStore";

// Mock the global ResizeObserver which might be needed by some components (Monaco, Resizable panels)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock the Zustand store
const mockStartAgent = vi.fn();
const mockSubmitAnswer = vi.fn();
const mockSetGithubUsername = vi.fn();
const mockSetBaseCv = vi.fn();

const defaultStoreState = {
  isRunning: false,
  isWizardComplete: false,
  githubUsername: "",
  baseCv: "",
  subagents: {},
  langgraphValues: {},
  messages: [],
  currentPhase: "",
  currentQuestion: "",
  targetRepos: [],
  reposProgress: {},
  startAgent: mockStartAgent,
  submitAnswer: mockSubmitAnswer,
  setGithubUsername: mockSetGithubUsername,
  setBaseCv: mockSetBaseCv,
};

vi.mock("../../store/useStore", () => ({
  useStore: vi.fn(),
}));

describe("Suite A: Frontend React Router DOM / Onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storeModule.useStore).mockImplementation(() => defaultStoreState as any);
  });

  it("A1. Renders the main title and logo", () => {
    render(<Onboarding />);
    expect(screen.getByText("Ingestion Payload")).toBeDefined();
    expect(screen.getByText("Graph Execution Pipeline")).toBeDefined();
  });

  it("A2. Input fields mount correctly", () => {
    render(<Onboarding />);
    expect(screen.getByPlaceholderText(/lgulbr or https:\/\/github.com\//)).toBeDefined();
    expect(screen.getByText("BASE_CV.md")).toBeDefined();
  });

  it("A3. Launch Command Graph button mounts disabled initially", () => {
    render(<Onboarding />);
    const btn = screen.getByText("Launch Command Graph");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("A4. Launch button gets enabled when inputs are filled", async () => {
    vi.mocked(storeModule.useStore).mockImplementation(() => ({
        ...defaultStoreState,
        githubUsername: "testuser",
        baseCv: "some text"
    }) as any);
    
    render(<Onboarding />);
    const btn = screen.getByText("Launch Command Graph");
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it("A5. Clicking Launch button triggers startAgent", async () => {
    vi.mocked(storeModule.useStore).mockImplementation(() => ({
        ...defaultStoreState,
        githubUsername: "testuser",
        baseCv: "some text"
    }) as any);
    
    render(<Onboarding />);
    const btn = screen.getByText("Launch Command Graph");
    fireEvent.click(btn);
    expect(mockStartAgent).toHaveBeenCalledTimes(1);
  });

  it("A6. UI shows Graph Offline when nothing is running", () => {
    render(<Onboarding />);
    expect(screen.getByText("Graph Offline")).toBeDefined();
  });

  it("A7. Subagent stream renders when running", () => {
    vi.mocked(storeModule.useStore).mockImplementation(() => ({
      ...defaultStoreState,
      isRunning: true,
      subagents: {
        agent1: { name: "Agent 1", status: "computing", message: "Fetching repos" }
      }
    }) as any);
    
    render(<Onboarding />);
    expect(screen.queryByText("Graph Offline")).toBeNull();
  });

  it("A8. Displays an interrupt question properly", () => {
    vi.mocked(storeModule.useStore).mockImplementation(() => ({
      ...defaultStoreState,
      isRunning: true,
      subagents: { agent1: { status: "waiting" } },
      currentPhase: "Interviewer",
      currentQuestion: "Can you elaborate on your DevOps experience?"
    }) as any);

    render(<Onboarding />);
    expect(screen.getByText("Can you elaborate on your DevOps experience?")).toBeDefined();
    expect(screen.getByText("Interviewer Question")).toBeDefined();
  });

  it("A9. Answer input accepts value and calls submitAnswer on submit", () => {
    vi.mocked(storeModule.useStore).mockImplementation(() => ({
      ...defaultStoreState,
      currentQuestion: "Question?"
    }) as any);

    render(<Onboarding />);
    const answerInput = screen.getByPlaceholderText(/Provide your answer/);
    
    // Type answer
    fireEvent.change(answerInput, { target: { value: "I have 5 years of experience." } });
    
    // Find the Send button
    // It's the only button in the question area other than the copy button.
    // We can find it by its icon or just grab the second button in that section.
    // The button should not be disabled.
    const buttons = screen.getAllByRole("button");
    const submitBtn = buttons[buttons.length - 1]; // Assuming it's the last button rendered
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(submitBtn);
    expect(mockSubmitAnswer).toHaveBeenCalledWith("I have 5 years of experience.");
  });

  it("A10. Renders back to memory link when wizard complete", () => {
    vi.mocked(storeModule.useStore).mockImplementation(() => ({
        ...defaultStoreState,
        isWizardComplete: true
    }) as any);
    
    render(
      <BrowserRouter>
        <Onboarding />
      </BrowserRouter>
    ); 

    expect(screen.getByText("Resume System Operation")).toBeDefined();
  });
});
