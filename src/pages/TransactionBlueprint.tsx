"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

// --- ICONS (Lucide React equivalents using SVG) ---
const ArrowRight = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>;
const ChevronLeft = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>;
const ChevronRight = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>;
const CheckCircle2 = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>;
const Plus = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>;
const GripVertical = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>;
const X = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>;
const MessageSquare = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const Download = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>;

// --- TYPES ---
export interface Task { id: string; name: string; description: string; trigger: string; responsible: string; required: boolean; }
export interface DocumentReq { id: string; name: string; collectedBy: string; reviewedBy: string; storage: string; access: string; }
export interface Communication { id: string; questions: string; updates: string; sender: string; timing: string; method: string; }
export interface Stage { id: string; name: string; purpose?: string; before?: string; completion?: string; delays?: string; risk?: string; tasks: Task[]; documents: DocumentReq[]; communications: Communication[]; }
export interface Snapshot { name: string; email: string; brokerage: string; teamSize: string; activeTransactions: string; currentMethod: string; stress: string; time: string; }
export interface FutureState { automate: string; delegate: string; eliminate: string; stress: string; bottlenecks: string; timeSaver: string; }

interface BlueprintState { snapshot: Snapshot; stages: Stage[]; futureState: FutureState; }
interface BlueprintContextType { data: BlueprintState; updateSnapshot: (d: Partial<Snapshot>) => void; updateStages: (s: Stage[]) => void; updateStage: (id: string, d: Partial<Stage>) => void; updateFutureState: (d: Partial<FutureState>) => void; resetBlueprint: () => void; }

// --- CONTEXT ---
const defaultStages: Stage[] = [
  { id: '1', name: 'Under Contract', tasks: [], documents: [], communications: [] },
  { id: '2', name: 'Escrow', tasks: [], documents: [], communications: [] },
  { id: '3', name: 'Inspection', tasks: [], documents: [], communications: [] },
  { id: '4', name: 'Financing', tasks: [], documents: [], communications: [] },
  { id: '5', name: 'Title', tasks: [], documents: [], communications: [] },
  { id: '6', name: 'Pre-Closing', tasks: [], documents: [], communications: [] },
  { id: '7', name: 'Closing', tasks: [], documents: [], communications: [] },
  { id: '8', name: 'Closed', tasks: [], documents: [], communications: [] },
];

const initialState: BlueprintState = {
  snapshot: { name: '', email: '', brokerage: '', teamSize: '', activeTransactions: '', currentMethod: '', stress: '', time: '' },
  stages: defaultStages,
  futureState: { automate: '', delegate: '', eliminate: '', stress: '', bottlenecks: '', timeSaver: '' },
};

const BlueprintContext = createContext<BlueprintContextType | undefined>(undefined);

const useBlueprint = () => {
  const context = useContext(BlueprintContext);
  if (!context) throw new Error('useBlueprint must be used within BlueprintProvider');
  return context;
};

// --- UI COMPONENTS (Tailwind Native) ---
const Button = ({ className = "", variant = "default", size = "default", ...props }: any) => {
  const base = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none gap-2";
  const variants: any = {
    default: "bg-[#0F4C81] text-white hover:bg-[#0F4C81]/90",
    outline: "border border-slate-200 bg-white hover:bg-slate-100 text-slate-900",
    ghost: "hover:bg-slate-100 text-slate-700",
  };
  const sizes: any = { default: "h-10 px-4 py-2", sm: "h-9 px-3", lg: "h-14 px-8 text-lg", icon: "h-10 w-10" };
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
};

const Input = ({ className = "", ...props }: any) => (
  <input className={`flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F4C81] disabled:opacity-50 ${className}`} {...props} />
);

const Textarea = ({ className = "", ...props }: any) => (
  <textarea className={`flex min-h-[80px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F4C81] disabled:opacity-50 ${className}`} {...props} />
);

const Label = ({ className = "", ...props }: any) => (
  <label className={`text-sm font-medium leading-none mb-2 block ${className}`} {...props} />
);

const Select = ({ value, onChange, options, placeholder }: any) => (
  <select value={value} onChange={onChange} className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]">
    <option value="" disabled>{placeholder}</option>
    {options.map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
  </select>
);

// --- STEPS ---
const SnapshotStep = () => {
  const { data, updateSnapshot } = useBlueprint();
  const { snapshot } = data;
  const handleChange = (f: string, v: string) => updateSnapshot({ [f]: v });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-slate-900">Tell us about your business</h3>
        <p className="text-slate-500">This helps contextualize your blueprint.</p>
        <div className="bg-[#0F4C81]/5 border border-[#0F4C81]/20 p-4 rounded-md mt-4 text-sm text-slate-800">
          <strong>Instructions:</strong> Fill out the details below to give us a snapshot of your current real estate business.
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div><Label>Full Name</Label><Input placeholder="Jane Doe" value={snapshot.name} onChange={(e: any) => handleChange("name", e.target.value)} /></div>
        <div><Label>Email Address</Label><Input type="email" placeholder="jane@example.com" value={snapshot.email} onChange={(e: any) => handleChange("email", e.target.value)} /></div>
        <div><Label>Brokerage / Team Name</Label><Input placeholder="Keller Williams" value={snapshot.brokerage} onChange={(e: any) => handleChange("brokerage", e.target.value)} /></div>
        <div><Label>Team Size</Label><Input placeholder="e.g. Solo, 2-5, 5+" value={snapshot.teamSize} onChange={(e: any) => handleChange("teamSize", e.target.value)} /></div>
        <div><Label>Avg. Active Transactions</Label><Input placeholder="e.g. 3-5 at a time" value={snapshot.activeTransactions} onChange={(e: any) => handleChange("activeTransactions", e.target.value)} /></div>
        <div><Label>Current Management Method</Label><Input placeholder="e.g. Whiteboard, Spreadsheets" value={snapshot.currentMethod} onChange={(e: any) => handleChange("currentMethod", e.target.value)} /></div>
      </div>
      <div className="space-y-6 pt-4 border-t border-slate-200">
        <div><Label>What part of your transaction process creates the most stress?</Label><Textarea value={snapshot.stress} onChange={(e: any) => handleChange("stress", e.target.value)} /></div>
        <div><Label>What part consumes the most time?</Label><Textarea value={snapshot.time} onChange={(e: any) => handleChange("time", e.target.value)} /></div>
      </div>
    </div>
  );
};

const PipelineStep = () => {
  const { data, updateStages } = useBlueprint();
  const { stages } = data;
  const [newStageName, setNewStageName] = useState("");

  const handleAdd = () => {
    if (!newStageName.trim()) return;
    updateStages([...stages, { id: Math.random().toString(36).substr(2, 9), name: newStageName.trim(), tasks: [], documents: [], communications: [] }]);
    setNewStageName("");
  };

  const handleRemove = (id: string) => updateStages(stages.filter(s => s.id !== id));
  const move = (idx: number, dir: number) => {
    if (idx + dir < 0 || idx + dir >= stages.length) return;
    const newS = [...stages];
    [newS[idx], newS[idx + dir]] = [newS[idx + dir], newS[idx]];
    updateStages(newS);
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-slate-900">Define Your Pipeline</h3>
        <p className="text-slate-500">What are the major milestones of your transaction?</p>
      </div>
      <div className="space-y-4">
        {stages.map((stage, idx) => (
          <div key={stage.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg group">
            <div className="flex flex-col gap-1 text-slate-400">
              <button onClick={() => move(idx, -1)} disabled={idx === 0} className="hover:text-slate-900 disabled:opacity-30"><GripVertical /></button>
            </div>
            <div className="flex-1 font-medium text-slate-900">{stage.name}</div>
            <Button variant="ghost" size="icon" onClick={() => handleRemove(stage.id)}><X /></Button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-4 border-t border-slate-200">
        <Input placeholder="New Stage Name" value={newStageName} onChange={(e: any) => setNewStageName(e.target.value)} onKeyDown={(e: any) => e.key === 'Enter' && handleAdd()} />
        <Button onClick={handleAdd}><Plus /> Add Stage</Button>
      </div>
    </div>
  );
};

const StagePlannerStep = () => {
  const { data, updateStage } = useBlueprint();
  const [activeId, setActiveId] = useState(data.stages[0]?.id || "");
  if (!data.stages.length) return <div>No stages.</div>;
  const stage = data.stages.find(s => s.id === activeId) || data.stages[0];
  const handleChange = (f: string, v: string) => updateStage(activeId, { [f]: v });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-slate-900">Stage Planner</h3>
        <p className="text-slate-500">Define the boundaries and risks for each stage.</p>
      </div>
      <div className="space-y-4">
        <Label>Select Stage</Label>
        <Select value={activeId} onChange={(e: any) => setActiveId(e.target.value)} options={data.stages.map(s => ({ value: s.id, label: s.name }))} placeholder="Select stage" />
      </div>
      <div className="space-y-6 pt-4 border-t border-slate-200">
        <div><Label>Purpose of this stage?</Label><Textarea value={stage.purpose || ""} onChange={(e: any) => handleChange("purpose", e.target.value)} /></div>
        <div><Label>What must happen BEFORE entering?</Label><Textarea value={stage.before || ""} onChange={(e: any) => handleChange("before", e.target.value)} /></div>
        <div><Label>What determines completion?</Label><Textarea value={stage.completion || ""} onChange={(e: any) => handleChange("completion", e.target.value)} /></div>
        <div><Label>Common delays?</Label><Textarea value={stage.delays || ""} onChange={(e: any) => handleChange("delays", e.target.value)} /></div>
        <div><Label>Biggest risk?</Label><Textarea value={stage.risk || ""} onChange={(e: any) => handleChange("risk", e.target.value)} /></div>
      </div>
    </div>
  );
};

const TaskChecklistStep = () => {
  const { data, updateStage } = useBlueprint();
  const [activeId, setActiveId] = useState(data.stages[0]?.id || "");
  const [newTask, setNewTask] = useState<Partial<Task>>({ name: "", description: "", trigger: "", responsible: "Realtor", required: true });
  if (!data.stages.length) return <div>No stages.</div>;
  const stage = data.stages.find(s => s.id === activeId) || data.stages[0];

  const handleAdd = () => {
    if (!newTask.name?.trim()) return;
    updateStage(activeId, { tasks: [...(stage.tasks || []), { id: Math.random().toString(), name: newTask.name, description: newTask.description || "", trigger: newTask.trigger || "", responsible: newTask.responsible || "Realtor", required: newTask.required ?? true }] });
    setNewTask({ name: "", description: "", trigger: "", responsible: "Realtor", required: true });
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2"><h3 className="text-xl font-bold text-slate-900">Task Checklist</h3></div>
      <Select value={activeId} onChange={(e: any) => setActiveId(e.target.value)} options={data.stages.map(s => ({ value: s.id, label: s.name }))} placeholder="Select stage" />
      <div className="space-y-4 pt-4 border-t border-slate-200">
        {stage.tasks?.map(t => (
          <div key={t.id} className="p-4 border border-slate-200 rounded-lg bg-white relative">
            <Button variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => updateStage(activeId, { tasks: stage.tasks.filter(x => x.id !== t.id) })}><X /></Button>
            <div className="font-medium text-slate-900">{t.name}</div>
            <div className="text-sm text-slate-500 mt-1">{t.description}</div>
            <div className="flex gap-4 mt-3 text-sm">
              <span className="bg-[#D9EAF7] text-[#0F4C81] px-2 py-1 rounded">Who: {t.responsible}</span>
              <span className="bg-slate-100 px-2 py-1 rounded text-slate-700">When: {t.trigger}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-4">
        <h4 className="font-medium text-slate-900">Add New Task</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Task Name</Label><Input value={newTask.name} onChange={(e: any) => setNewTask({...newTask, name: e.target.value})} /></div>
          <div><Label>Trigger / Due Date</Label><Input value={newTask.trigger} onChange={(e: any) => setNewTask({...newTask, trigger: e.target.value})} /></div>
          <div className="md:col-span-2"><Label>Description</Label><Input value={newTask.description} onChange={(e: any) => setNewTask({...newTask, description: e.target.value})} /></div>
          <div><Label>Responsible Party</Label>
            <Select value={newTask.responsible} onChange={(e: any) => setNewTask({...newTask, responsible: e.target.value})} options={["Realtor", "Transaction Coordinator", "Assistant", "Client", "Lender", "Title Company", "Other"].map(x => ({ value: x, label: x }))} placeholder="Select owner" />
          </div>
          <div className="flex items-center space-x-2 pt-8">
            <input type="checkbox" checked={newTask.required} onChange={(e) => setNewTask({...newTask, required: e.target.checked})} className="h-4 w-4 rounded border-slate-300" />
            <Label className="mb-0">Required Task</Label>
          </div>
        </div>
        <Button onClick={handleAdd}><Plus /> Add Task</Button>
      </div>
    </div>
  );
};

const DocumentChecklistStep = () => {
  const { data, updateStage } = useBlueprint();
  const [activeId, setActiveId] = useState(data.stages[0]?.id || "");
  const [newDoc, setNewDoc] = useState<Partial<DocumentReq>>({ name: "", collectedBy: "Realtor", reviewedBy: "Realtor", storage: "Google Drive", access: "Internal Only" });
  if (!data.stages.length) return <div>No stages.</div>;
  const stage = data.stages.find(s => s.id === activeId) || data.stages[0];

  const handleAdd = () => {
    if (!newDoc.name?.trim()) return;
    updateStage(activeId, { documents: [...(stage.documents || []), { id: Math.random().toString(), name: newDoc.name, collectedBy: newDoc.collectedBy || "", reviewedBy: newDoc.reviewedBy || "", storage: newDoc.storage || "", access: newDoc.access || "" }] });
    setNewDoc({ name: "", collectedBy: "Realtor", reviewedBy: "Realtor", storage: "Google Drive", access: "Internal Only" });
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2"><h3 className="text-xl font-bold text-slate-900">Document Checklist</h3></div>
      <Select value={activeId} onChange={(e: any) => setActiveId(e.target.value)} options={data.stages.map(s => ({ value: s.id, label: s.name }))} placeholder="Select stage" />
      <div className="space-y-4 pt-4 border-t border-slate-200">
        {stage.documents?.map(d => (
          <div key={d.id} className="p-4 border border-slate-200 rounded-lg bg-white relative">
            <Button variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => updateStage(activeId, { documents: stage.documents.filter(x => x.id !== d.id) })}><X /></Button>
            <div className="font-medium text-slate-900">📄 {d.name}</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs md:text-sm text-slate-600">
              <div className="bg-slate-100 px-2 py-1 rounded"><span className="font-semibold block text-slate-400">Collected By</span> {d.collectedBy}</div>
              <div className="bg-slate-100 px-2 py-1 rounded"><span className="font-semibold block text-slate-400">Reviewed By</span> {d.reviewedBy}</div>
              <div className="bg-slate-100 px-2 py-1 rounded"><span className="font-semibold block text-slate-400">Storage</span> {d.storage}</div>
              <div className="bg-slate-100 px-2 py-1 rounded"><span className="font-semibold block text-slate-400">Access</span> {d.access}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-4">
        <h4 className="font-medium text-slate-900">Add New Document</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2"><Label>Document Name</Label><Input value={newDoc.name} onChange={(e: any) => setNewDoc({...newDoc, name: e.target.value})} /></div>
          <div><Label>Collected By</Label><Input value={newDoc.collectedBy} onChange={(e: any) => setNewDoc({...newDoc, collectedBy: e.target.value})} /></div>
          <div><Label>Reviewed By</Label><Input value={newDoc.reviewedBy} onChange={(e: any) => setNewDoc({...newDoc, reviewedBy: e.target.value})} /></div>
          <div><Label>Storage Location</Label><Input value={newDoc.storage} onChange={(e: any) => setNewDoc({...newDoc, storage: e.target.value})} /></div>
          <div><Label>Access Level</Label><Input value={newDoc.access} onChange={(e: any) => setNewDoc({...newDoc, access: e.target.value})} /></div>
        </div>
        <Button onClick={handleAdd}><Plus /> Add Document</Button>
      </div>
    </div>
  );
};

const CommunicationStep = () => {
  const { data, updateStage } = useBlueprint();
  const [activeId, setActiveId] = useState(data.stages[0]?.id || "");
  const [newComm, setNewComm] = useState<Partial<Communication>>({ questions: "", updates: "", sender: "Realtor", timing: "", method: "Email" });
  if (!data.stages.length) return <div>No stages.</div>;
  const stage = data.stages.find(s => s.id === activeId) || data.stages[0];

  const handleAdd = () => {
    if (!newComm.updates?.trim()) return;
    updateStage(activeId, { communications: [...(stage.communications || []), { id: Math.random().toString(), questions: newComm.questions || "", updates: newComm.updates, sender: newComm.sender || "Realtor", timing: newComm.timing || "", method: newComm.method || "Email" }] });
    setNewComm({ questions: "", updates: "", sender: "Realtor", timing: "", method: "Email" });
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2"><h3 className="text-xl font-bold text-slate-900">Communication Plan</h3></div>
      <Select value={activeId} onChange={(e: any) => setActiveId(e.target.value)} options={data.stages.map(s => ({ value: s.id, label: s.name }))} placeholder="Select stage" />
      <div className="space-y-4 pt-4 border-t border-slate-200">
        {stage.communications?.map(c => (
          <div key={c.id} className="p-4 border border-slate-200 rounded-lg bg-white relative">
            <Button variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => updateStage(activeId, { communications: stage.communications.filter(x => x.id !== c.id) })}><X /></Button>
            <div className="font-medium flex items-center gap-2 mb-2 text-slate-900"><MessageSquare /> {c.updates}</div>
            {c.questions && <div className="text-sm text-slate-500 mb-3 italic">Addresses: "{c.questions}"</div>}
            <div className="flex gap-2 text-xs mt-2 text-slate-700">
              <span className="bg-[#D9EAF7] text-[#0F4C81] px-2 py-1 rounded">From: {c.sender}</span>
              <span className="bg-slate-100 px-2 py-1 rounded">When: {c.timing}</span>
              <span className="bg-slate-100 px-2 py-1 rounded">Via: {c.method}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-4">
        <h4 className="font-medium text-slate-900">Add Communication Protocol</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2"><Label>What updates should they receive?</Label><Input value={newComm.updates} onChange={(e: any) => setNewComm({...newComm, updates: e.target.value})} /></div>
          <div className="md:col-span-2"><Label>What questions do clients commonly ask here?</Label><Textarea value={newComm.questions} onChange={(e: any) => setNewComm({...newComm, questions: e.target.value})} /></div>
          <div><Label>Who sends the update?</Label><Input value={newComm.sender} onChange={(e: any) => setNewComm({...newComm, sender: e.target.value})} /></div>
          <div><Label>When should it be sent?</Label><Input value={newComm.timing} onChange={(e: any) => setNewComm({...newComm, timing: e.target.value})} /></div>
          <div><Label>Delivery Method</Label><Select value={newComm.method} onChange={(e: any) => setNewComm({...newComm, method: e.target.value})} options={["Email", "Text", "Phone", "In Person"].map(x => ({ value: x, label: x }))} placeholder="Select method" /></div>
        </div>
        <Button onClick={handleAdd}><Plus /> Add Protocol</Button>
      </div>
    </div>
  );
};

const ResponsibilityStep = () => {
  const { data } = useBlueprint();
  const allTasks = data.stages.flatMap(s => (s.tasks || []).map(t => ({ ...t, stageName: s.name })));
  const grouped = allTasks.reduce((acc: any, t) => {
    acc[t.responsible] = acc[t.responsible] || [];
    acc[t.responsible].push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div className="space-y-2"><h3 className="text-xl font-bold text-slate-900">Responsibility Matrix</h3></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(grouped).map(([owner, tasks]: any) => (
          <div key={owner} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-semibold flex justify-between items-center text-slate-900">
              <span>{owner}</span><span className="bg-[#D9EAF7] text-[#0F4C81] text-xs px-2 py-1 rounded-full">{tasks.length} tasks</span>
            </div>
            <div className="divide-y divide-slate-100">
              {tasks.map((t: any, i: number) => (
                <div key={i} className="px-4 py-3 text-sm">
                  <div className="font-medium text-slate-900">{t.name}</div>
                  <div className="text-slate-500 text-xs mt-1">Stage: {t.stageName} • When: {t.trigger}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const FutureStateStep = () => {
  const { data, updateFutureState } = useBlueprint();
  const handleChange = (f: string, v: string) => updateFutureState({ [f]: v });
  return (
    <div className="space-y-8">
      <div className="space-y-2"><h3 className="text-xl font-bold text-slate-900">Future State Planning</h3></div>
      <div className="space-y-6">
        <div><Label>What would you automate?</Label><Textarea value={data.futureState.automate} onChange={(e: any) => handleChange("automate", e.target.value)} /></div>
        <div><Label>What would you delegate?</Label><Textarea value={data.futureState.delegate} onChange={(e: any) => handleChange("delegate", e.target.value)} /></div>
        <div><Label>What would you eliminate entirely?</Label><Textarea value={data.futureState.eliminate} onChange={(e: any) => handleChange("eliminate", e.target.value)} /></div>
        <div><Label>What creates the most bottlenecks currently?</Label><Textarea value={data.futureState.bottlenecks} onChange={(e: any) => handleChange("bottlenecks", e.target.value)} /></div>
      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---
export default function BlueprintApp() {
  const [view, setView] = useState("landing");
  const [currentStep, setCurrentStep] = useState(1);
  const [blueprintData, setBlueprintData] = useState<BlueprintState>(initialState);

  const contextValue: BlueprintContextType = {
    data: blueprintData,
    updateSnapshot: (d) => setBlueprintData(p => ({ ...p, snapshot: { ...p.snapshot, ...d } })),
    updateStages: (s) => setBlueprintData(p => ({ ...p, stages: s })),
    updateStage: (id, d) => setBlueprintData(p => ({ ...p, stages: p.stages.map(s => s.id === id ? { ...s, ...d } : s) })),
    updateFutureState: (d) => setBlueprintData(p => ({ ...p, futureState: { ...p.futureState, ...d } })),
    resetBlueprint: () => setBlueprintData(initialState),
  };

  const steps = [
    { id: 1, name: "Transaction Snapshot", component: SnapshotStep },
    { id: 2, name: "Pipeline Builder", component: PipelineStep },
    { id: 3, name: "Stage Planner", component: StagePlannerStep },
    { id: 4, name: "Task Checklist", component: TaskChecklistStep },
    { id: 5, name: "Document Checklist", component: DocumentChecklistStep },
    { id: 6, name: "Communication Plan", component: CommunicationStep },
    { id: 7, name: "Responsibility Matrix", component: ResponsibilityStep },
    { id: 8, name: "Future State", component: FutureStateStep },
  ];

  const handleNext = () => currentStep < steps.length ? setCurrentStep(p => p + 1) : setView("summary");
  const handleBack = () => currentStep > 1 ? setCurrentStep(p => p - 1) : setView("landing");

  const CurrentStepComponent = steps.find(s => s.id === currentStep)?.component || SnapshotStep;

  return (
    <BlueprintContext.Provider value={contextValue}>
      <div className="min-h-screen bg-[#F8FAFC] text-[#1F2937] font-sans">
        
        {view === "landing" && (
          <div>
            <header className="border-b border-slate-200 bg-white">
              <div className="container mx-auto px-4 h-16 flex items-center">
                <img src="https://vibe.filesafe.space/1781650999140379295/attachments/ba618e62-080c-4c18-bd1f-744efe397fa9.png" alt="DoorScale Logo" className="h-10 w-auto" />
              </div>
            </header>
            <main className="py-20 md:py-32 px-4 text-center max-w-4xl mx-auto">
              <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-500 mb-8">The Realtor Transaction Blueprint</div>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
                Document, Organize, and Standardize Your Transaction Process <br className="hidden md:block" />
                <span className="text-[#0F4C81]">Before It Starts Managing You</span>
              </h1>
              <p className="text-xl text-slate-500 mb-10 max-w-2xl mx-auto">Build a documented transaction process you can scale, delegate, automate, or hand off to a transaction coordinator.</p>
              <div className="flex justify-center gap-4">
                <Button size="lg" onClick={() => setView("builder")}>Start Building My Blueprint <ArrowRight /></Button>
              </div>
            </main>
          </div>
        )}

        {view === "builder" && (
          <div className="flex flex-col min-h-screen">
            <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
              <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <img src="https://vibe.filesafe.space/1781650999140379295/attachments/ba618e62-080c-4c18-bd1f-744efe397fa9.png" alt="DoorScale" className="h-10 w-auto cursor-pointer" onClick={() => setView("landing")} />
                <div className="flex items-center gap-4">
                  <div className="text-sm font-medium text-slate-500 hidden sm:block">Step {currentStep} of {steps.length}</div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleBack}><ChevronLeft /> Back</Button>
                    <Button size="sm" onClick={handleNext}>{currentStep === steps.length ? "Finish" : "Next"} <ChevronRight /></Button>
                  </div>
                </div>
              </div>
              <div className="h-1 bg-[#D9EAF7] w-full">
                <div className="h-full bg-[#0F4C81] transition-all duration-300" style={{ width: `${(currentStep / steps.length) * 100}%` }} />
              </div>
            </header>
            <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
              <h2 className="text-3xl font-bold mb-8">{steps.find(s => s.id === currentStep)?.name}</h2>
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mb-8">
                <CurrentStepComponent />
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={handleBack}><ChevronLeft /> Back</Button>
                <Button onClick={handleNext}>{currentStep === steps.length ? "Finish Blueprint" : "Continue"} <ChevronRight /></Button>
              </div>
            </main>
          </div>
        )}

        {view === "summary" && (
          <div>
            <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
              <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <img src="https://vibe.filesafe.space/1781650999140379295/attachments/ba618e62-080c-4c18-bd1f-744efe397fa9.png" alt="DoorScale Logo" className="h-10 w-auto cursor-pointer" onClick={() => setView("landing")} />
                <Button onClick={() => setView("results")}><Download /> Finish & Submit</Button>
              </div>
            </header>
            <main className="container mx-auto px-4 py-12 max-w-5xl">
              <div className="text-center mb-12">
                <h1 className="text-4xl font-bold mb-4">Your Transaction Blueprint</h1>
                <p className="text-xl text-slate-500">Review your customized process below.</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-12">
                <section>
                  <h2 className="text-2xl font-bold border-b border-slate-200 pb-2 mb-6">Business Snapshot</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div><div className="text-sm text-slate-500">Name</div><div className="font-medium">{blueprintData.snapshot.name || "N/A"}</div></div>
                    <div><div className="text-sm text-slate-500">Brokerage</div><div className="font-medium">{blueprintData.snapshot.brokerage || "N/A"}</div></div>
                  </div>
                </section>
                <section>
                  <h2 className="text-2xl font-bold border-b border-slate-200 pb-2 mb-6">Pipeline</h2>
                  <div className="space-y-8">
                    {blueprintData.stages.map((s, i) => (
                      <div key={s.id} className="border border-slate-200 rounded-lg p-6 bg-slate-50">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                          <span className="bg-[#0F4C81] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">{i + 1}</span>
                          {s.name}
                        </h3>
                        <div className="grid md:grid-cols-2 gap-8">
                          <div><h4 className="font-semibold mb-3">Tasks</h4><ul className="text-sm space-y-1">{s.tasks?.map(t => <li key={t.id}>• {t.name}</li>)}</ul></div>
                          <div><h4 className="font-semibold mb-3">Documents</h4><ul className="text-sm space-y-1">{s.documents?.map(d => <li key={d.id}>• {d.name}</li>)}</ul></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </main>
          </div>
        )}

        {view === "results" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-8 mx-auto">
              <CheckCircle2 />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Your Transaction Blueprint Is Ready</h1>
            <p className="text-xl text-slate-500 max-w-xl mx-auto mb-8">Most Realtors never take the time to document their transaction process. You now have a blueprint that can be delegated, automated, and systemized.</p>
            <a href="https://doorscale.com/tc-system" target="_blank" rel="noreferrer">
              <Button size="lg">Join the Founding Member Waitlist</Button>
            </a>
          </div>
        )}

      </div>
    </BlueprintContext.Provider>
  );
}