import React, { useState } from 'react';
import { useTailorAgent } from './hooks/useTailorAgent';
import { useImproverAgent } from './hooks/useImproverAgent';
import { AgentLogViewer } from './components/features/AgentLogViewer';
import { ChatStreamViewer } from './components/features/ChatStreamViewer';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw, Github, FileText, Briefcase, Send, User, CheckCircle, AlertCircle, Activity, Star } from 'lucide-react';
import Markdown from 'react-markdown';

export default function App() {
  const [githubUsername, setGithubUsername] = useState('');
  const [baseCv, setBaseCv] = useState('');
  const [jobDescription, setJobDescription] = useState('');

  const tailor = useTailorAgent();
  const improver = useImproverAgent();

  const handleImproverAnswers = () => {
    // Collect answers
    const answers: Record<string, string> = {};
    improver.questions.forEach(q => {
      const el = document.getElementById(`q_${q}`) as HTMLTextAreaElement;
      if (el) answers[q] = el.value;
    });
    improver.submitAnswers(answers);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 pb-24">
      <header className="border-b bg-background/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/50">
              <RefreshCw className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">MainCurriculum <Badge variant="secondary" className="ml-2">v2.0 Beta</Badge></h1>
          </div>
          <div className="text-sm text-muted-foreground font-mono flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
            LangGraph Multi-Agent Engine
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="improver" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
            <TabsTrigger value="improver">10/10 CV Improver (HITL)</TabsTrigger>
            <TabsTrigger value="tailor">Job Tailor Agent</TabsTrigger>
          </TabsList>

          {/* ------------- IMPROVER TAB ------------- */}
          <TabsContent value="improver" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Inputs */}
              <div className="lg:col-span-5 space-y-6 flex flex-col">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center"><Github className="w-5 h-5 mr-2" /> GitHub Portfolio</CardTitle>
                    <CardDescription>The agent fetches public repos to ground the CV in reality.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Input 
                      placeholder="Username (e.g. torvalds)" 
                      value={githubUsername} 
                      onChange={(e) => setGithubUsername(e.target.value)} 
                    />
                  </CardContent>
                </Card>

                <Card className="flex-1 flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center"><FileText className="w-5 h-5 mr-2" /> Base CV</CardTitle>
                    <CardDescription>Paste your raw markdown CV here.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <Textarea 
                      className="min-h-[250px] font-mono whitespace-pre" 
                      placeholder="# My Resume..."
                      value={baseCv}
                      onChange={(e) => setBaseCv(e.target.value)}
                    />
                  </CardContent>
                </Card>

                {improver.error && (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-start text-sm">
                    <AlertCircle className="w-5 h-5 mr-2 shrink-0" />
                    <p>{improver.error}</p>
                  </div>
                )}

                {!improver.needsHumanInput && (
                  <Button 
                    className="w-full h-12 text-md" 
                    size="lg" 
                    onClick={() => improver.runImprover(baseCv, githubUsername)}
                    disabled={improver.isRunning}
                  >
                    {improver.isRunning ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Simulating Evaluators...</> : <><Star className="w-5 h-5 mr-2" /> Start Improvement Loop</>}
                  </Button>
                )}

                {/* Human In The Loop Block */}
                {improver.needsHumanInput && (
                  <Card className="border-primary bg-primary/5 animate-in fade-in zoom-in-95 duration-300">
                    <CardHeader>
                      <CardTitle className="flex items-center text-primary"><User className="w-5 h-5 mr-2" /> Human-in-the-Loop</CardTitle>
                      <CardDescription className="text-primary/80">
                        The agent needs details to implement the STAR method correctly without hallucinating.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {improver.questions.map((q, idx) => (
                        <div key={idx} className="space-y-2">
                          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{q}</label>
                          <Textarea id={`q_${q}`} placeholder="Provide specific Situation, Task, Action, Result..." />
                        </div>
                      ))}
                      <Button onClick={handleImproverAnswers} className="w-full mt-4" disabled={improver.isRunning}>
                        {improver.isRunning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Resuming...</> : <><Send className="w-4 h-4 mr-2"/> Submit & Resume Thread</>}
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right Column: Analytics & Execution */}
              <div className="lg:col-span-7 flex flex-col space-y-6">
                
                {/* Status Dashboard */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="flex flex-col items-center justify-center p-6 bg-card border-border">
                    <div className="text-sm text-muted-foreground uppercase tracking-wider font-mono mb-2">SOTA Score</div>
                    <div className={`text-5xl font-bold ${improver.score >= 9.5 ? 'text-primary' : improver.score >= 7 ? 'text-yellow-500' : 'text-destructive'}`}>
                      {improver.score > 0 ? `${improver.score}/10` : '-'}
                    </div>
                  </Card>
                  <Card className="flex flex-col p-4 bg-card border-border overflow-hidden">
                    <div className="text-sm text-muted-foreground uppercase tracking-wider font-mono mb-2">Latest Critique</div>
                    <ScrollArea className="h-20 text-sm text-card-foreground">
                      {improver.critique || "Waiting for evaluation..."}
                    </ScrollArea>
                  </Card>
                </div>

                <AgentLogViewer progress={improver.progress} isRunning={improver.isRunning} />
                <ChatStreamViewer streamingTokens={improver.streamingTokens} activeNodes={improver.activeNodes} />

                {(improver.currentCv || !improver.isRunning) && (
                  <Card className="flex-1 overflow-hidden flex flex-col min-h-[400px]">
                    <CardHeader className="py-4 border-b bg-muted/20 flex flex-row items-center justify-between">
                      <CardTitle className="text-lg flex items-center">
                        <CheckCircle className="w-5 h-5 mr-2 text-primary" /> Live Validation Preview
                      </CardTitle>
                    </CardHeader>
                    <ScrollArea className="flex-1 p-6">
                      <div className="prose prose-invert prose-emerald max-w-none prose-sm leading-relaxed">
                        <Markdown>{improver.currentCv || "*Submit to see output*"}</Markdown>
                      </div>
                    </ScrollArea>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ------------- TAILOR TAB ------------- */}
          <TabsContent value="tailor" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column */}
              <div className="lg:col-span-5 flex flex-col space-y-6">
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center"><Briefcase className="w-5 h-5 mr-2" /> Target Job</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea 
                      placeholder="Paste Job Description..." 
                      className="min-h-[150px]"
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center"><FileText className="w-5 h-5 mr-2" /> Base CV</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea 
                      placeholder="Paste your markdown CV..." 
                      className="min-h-[150px] font-mono"
                      value={baseCv}
                      onChange={(e) => setBaseCv(e.target.value)}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center"><Github className="w-5 h-5 mr-2" /> GitHub Context</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Input 
                      placeholder="Username for deep repo dive" 
                      value={githubUsername}
                      onChange={(e) => setGithubUsername(e.target.value)}
                    />
                  </CardContent>
                </Card>

                {tailor.error && (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-start text-sm">
                    <AlertCircle className="w-5 h-5 mr-2 shrink-0" />
                    <p>{tailor.error}</p>
                  </div>
                )}

                <Button 
                  className="w-full h-12 text-md" 
                  size="lg" 
                  onClick={() => tailor.runTailor(jobDescription, baseCv, githubUsername)}
                  disabled={tailor.isRunning}
                >
                  {tailor.isRunning ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing Pipelines...</> : <><Send className="w-5 h-5 mr-2" /> Build Tailored Package</>}
                </Button>

              </div>

              {/* Right Column */}
              <div className="lg:col-span-7 flex flex-col space-y-6">
                
                <AgentLogViewer progress={tailor.progress} isRunning={tailor.isRunning} />
                <ChatStreamViewer streamingTokens={tailor.streamingTokens} activeNodes={tailor.activeNodes} />

                {tailor.result && (
                  <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                    <Card>
                      <CardHeader className="border-b bg-muted/20">
                        <CardTitle className="flex items-center"><Star className="w-5 h-5 mr-2 text-primary" /> Tailored Cover Letter</CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 prose prose-invert max-w-none prose-sm">
                        <Markdown>{tailor.result.coverLetter}</Markdown>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="border-b bg-muted/20">
                        <CardTitle className="flex items-center"><CheckCircle className="w-5 h-5 mr-2 text-primary" /> Tailored CV</CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 prose prose-invert max-w-none prose-sm">
                        <Markdown>{tailor.result.cv}</Markdown>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>

            </div>
          </TabsContent>
          
        </Tabs>
      </main>
    </div>
  );
}
