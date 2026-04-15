import { useState, useCallback, useEffect } from "react";

export type SSEMessage = {
  type: string;
  message?: string;
  data?: any;
};

export function useBackendAgent(endpoint: string) {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [activeNodes, setActiveNodes] = useState<string[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string>("Parsing Github...");
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [isWizardComplete, setIsWizardComplete] = useState<boolean>(false);

  useEffect(() => {
    if (!isRunning) return;

    const eventSource = new EventSource(endpoint);

    eventSource.onmessage = (event) => {
      const parsed = JSON.parse(event.data) as SSEMessage;
      
      if (parsed.type === "ping") return;

      if (parsed.type === "log") {
        setLogs(prev => [...prev, parsed.message!]);
      }
      
      if (parsed.type === "node_start") {
        setActiveNodes(prev => [...prev, parsed.data.node]);
        setProgress(parsed.data.progress || 0);
      }
      
      if (parsed.type === "node_end") {
        setActiveNodes(prev => prev.filter(n => n !== parsed.data.node));
      }

      if (parsed.type === "interrupt") {
        setCurrentPhase(parsed.data.phase || "Interview Phase");
        setCurrentQuestion(parsed.data.question);
        setLogs(prev => [...prev, "Agent paused for user input..."]);
      }

      if (parsed.type === "complete") {
        setIsRunning(false);
        setIsWizardComplete(true);
        setCurrentPhase("Onboarding Complete");
        eventSource.close();
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Error:", err);
      eventSource.close();
      setIsRunning(false);
    };

    return () => {
      eventSource.close();
    };
  }, [isRunning, endpoint]);

  const startAgent = useCallback(async (payload: any) => {
    setIsRunning(true);
    setLogs([]);
    setCurrentQuestion(null);
    setProgress(0);
    
    // Post to trigger execution backend, which then broadcasts to SSE
    await fetch("/api/ingest/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }, []);

  const submitAnswer = useCallback(async (answer: string) => {
    setCurrentQuestion(null);
    await fetch("/api/ingest/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    });
  }, []);

  return {
    isRunning,
    logs,
    progress,
    activeNodes,
    currentPhase,
    currentQuestion,
    isWizardComplete,
    startAgent,
    submitAnswer
  };
}
