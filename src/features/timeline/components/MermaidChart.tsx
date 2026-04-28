import { useEffect, useRef } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
  fontFamily: "monospace",
});

export const MermaidChart = ({ chart }: { chart: string }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    const renderChart = async () => {
      try {
        if (ref.current) {
          ref.current.innerHTML = ""; // clear old
          const id = "mermaid-" + Math.random().toString(36).substr(2, 9);
          const { svg } = await mermaid.render(id, chart);
          if (isMounted && ref.current) {
            ref.current.innerHTML = svg;
          }
        }
      } catch (e) {
        console.error("Mermaid parsing error", e);
        if (isMounted && ref.current) {
          ref.current.innerHTML = `<div class="text-red-400 text-sm p-4 bg-red-900/30 rounded-lg whitespace-pre-wrap">Mermaid syntax error:\n${e}</div>`;
        }
      }
    };
    renderChart();
    return () => {
      isMounted = false;
    };
  }, [chart]);

  return (
    <div
      ref={ref}
      className="mermaid w-full flex justify-center overflow-hidden bg-black/30 rounded-xl mb-6 shadow-inner border border-white/10 print:bg-transparent print:border-none print:shadow-none"
    />
  );
};
