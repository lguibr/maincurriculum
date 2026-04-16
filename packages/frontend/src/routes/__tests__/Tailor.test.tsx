import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import Tailor from "../Tailor";

// Mock global fetch globally
global.fetch = vi.fn();

describe("Suite D: Frontend React Router DOM / Tailor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default /api/profile/latest behavior
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes("/api/profile/latest")) {
        return Promise.resolve({
          json: () => Promise.resolve({ id: 1 }),
        });
      }
      if (url.includes("/api/tailor")) {
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              tailoredCv: "Mocked CV",
              coverLetter: "Mocked Letter",
              employerAnswers: "Mocked QA",
            }),
        });
      }
      return Promise.reject("Not Found");
    });
  });

  it("D1. Component renders base Job Description textarea", async () => {
    render(<Tailor />);
    expect(screen.getByPlaceholderText(/Paste the target job description here/)).toBeDefined();
  });

  it("D2. Employer Questions textarea is newly active", async () => {
    render(<Tailor />);
    expect(screen.getByPlaceholderText(/salary expectation/)).toBeDefined();
  });

  it("D3. Primary CTA button mounts effectively disabled", async () => {
    render(<Tailor />);
    const btn = screen.getByText("Generate RAG Application");
    expect((btn as HTMLButtonElement).disabled).toBe(true); // requires text
  });

  it("D4. Entering Job text unlocks Generate button", async () => {
    render(<Tailor />);
    const jobInput = screen.getByPlaceholderText(/Paste the target job description here/);
    fireEvent.change(jobInput, { target: { value: "I need a dev" } });

    await waitFor(() => {
      const btn = screen.getByText("Generate RAG Application");
      expect((btn as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it("D5. Fire Generate CTA toggles loading states", async () => {
    render(<Tailor />);

    // Input text to enable button
    const jobInput = screen.getByPlaceholderText(/Paste the target job description here/);
    fireEvent.change(jobInput, { target: { value: "Developer role" } });

    // Wait till it fetches ID on mount
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/profile/latest"))
    );

    const btn = screen.getByText("Generate RAG Application");
    fireEvent.click(btn);

    // Ensure loader text replaces button text immediately
    await waitFor(() => {
      expect(screen.getByText("Agent is writing...")).toBeDefined();
    });
  });

  it("D6. Tab architecture initializes on CV active", async () => {
    render(<Tailor />);
    const activeTab = screen.getByText("Tailored CV");
    expect(activeTab.className).toContain("text-primary"); // The active styling
  });

  it("D7. Clicking Cover Letter Tab switches view", async () => {
    render(<Tailor />);
    const letterTab = screen.getByText("Cover Letter");
    fireEvent.click(letterTab);
    expect(letterTab.className).toContain("text-primary"); // Becomes active
  });

  it("D8. Completing fetch renders dynamic JSON outputs", async () => {
    render(<Tailor />);
    fireEvent.change(screen.getByPlaceholderText(/Paste the target job description here/), {
      target: { value: "Role" },
    });
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/profile/latest"))
    );

    fireEvent.click(screen.getByText("Generate RAG Application"));

    // Should eventually resolve Mocked CV via react-markdown
    await waitFor(() => {
      expect(screen.getByText("Mocked CV")).toBeDefined();
    });
  });

  it("D9. Output renders Cover Letter correctly post-generation", async () => {
    render(<Tailor />);
    fireEvent.change(screen.getByPlaceholderText(/Paste the target job description here/), {
      target: { value: "Role" },
    });
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/profile/latest"))
    );

    fireEvent.click(screen.getByText("Generate RAG Application"));
    await waitFor(() => expect(screen.getByText("Mocked CV")).toBeDefined());

    // Switch tab
    fireEvent.click(screen.getByText("Cover Letter"));

    await waitFor(() => {
      expect(screen.getByText("Mocked Letter")).toBeDefined();
    });
  });

  it("D10. Output successfully maps employerAnswers to the QA tab", async () => {
    render(<Tailor />);
    fireEvent.change(screen.getByPlaceholderText(/Paste the target job description here/), {
      target: { value: "Role" },
    });
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/profile/latest"))
    );

    fireEvent.click(screen.getByText("Generate RAG Application"));
    await waitFor(() => expect(screen.getByText("Mocked CV")).toBeDefined());

    // Switch tab
    fireEvent.click(screen.getByText("Form Answers"));

    await waitFor(() => {
      expect(screen.getByText("Mocked QA")).toBeDefined();
    });
  });
});
