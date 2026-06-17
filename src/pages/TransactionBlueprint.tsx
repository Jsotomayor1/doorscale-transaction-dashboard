import React, { useState, useRef } from "react";

/* ============================================================
   TYPES
   ============================================================ */

export interface Task {
  id: string;
  name: string;
  description?: string;
  trigger?: string;
  owner?: string;
  requirement?: string;
}

export interface DocItem {
  id: string;
  name: string;
  collectedBy?: string;
  reviewedBy?: string;
  storedWhere?: string;
  accessNeeded?: string;
}

export interface CommItem {
  id: string;
  question?: string;
  update?: string;
  sender?: string;
  timing?: string;
  method?: string;
}

export interface StageData {
  purpose?: string;
  entry?: string;
  exit?: string;
  delays?: string;
  risk?: string;
  tasks: Task[];
  documents: DocItem[];
  communications: CommItem[];
}

export type StageDataMap = Record<string, StageData>;

export interface Snapshot {
  name?: string;
  email?: string;
  brokerage?: string;
  teamSize?: string;
  activeTransactions?: string;
  currentMethod?: string;
  stress?: string;
  time?: string;
}

export interface FutureState {
  automate?: string;
  delegate?: string;
  eliminate?: string;
  stress?: string;
  bottlenecks?: string;
  timeSavings?: string;
}

/* ============================================================
   DESIGN TOKENS — DoorScale Brand
   ============================================================ */
const COLORS: { [k: string]: string } = {
  primary: "#0F4C81",
  secondary: "#1E73BE",
  accent: "#D9EAF7",
  bg: "#F8FAFC",
  text: "#1F2937",
  textMuted: "#5B6472",
  success: "#22C55E",
  warning: "#F59E0B",
  line: "#E2E8F0",
  white: "#FFFFFF",
  navy: "#0A2E4D",
};

const FONT_HEAD = "'Montserrat', 'Segoe UI', sans-serif";
const FONT_BODY = "'Inter', 'Segoe UI', sans-serif";

const DEFAULT_STAGES = [
  "Under Contract",
  "Inspection",
  "Financing",
  "Title",
  "Pre-Closing",
  "Closing",
];

const OWNERS = ["Realtor", "Transaction Coordinator", "Assistant", "Client", "Lender", "Title Company", "Vendor", "Other"];
const DELIVERY = ["Email", "Text", "Phone", "In Person"];
const REQUIRED_OPT = ["Required", "Optional"];

const STEP_LABELS = [
  "Welcome",
  "Snapshot",
  "Pipeline",
  "Stage Planner",
  "Task Checklists",
  "Documents",
  "Communication",
  "Responsibility",
  "Future State",
  "Get Your Blueprint",
  "Your Blueprint",
];

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function emptyStageData(stageNames: string[]): StageDataMap {
  const obj: StageDataMap = {};
  stageNames.forEach((s) => {
    obj[s] = {
      purpose: '', entry: '', exit: '', delays: '', risk: '',
      tasks: [],
      documents: [],
      communications: [],
    };
  });
  return obj;
}

/* ============================================================
   SAMPLE BLUEPRINT — prefilled demo data for "See Sample Blueprint"
   ============================================================ */
const SAMPLE_STAGES = ["Under Contract", "Inspection", "Financing", "Title", "Pre-Closing", "Closing"];

const SAMPLE_SNAPSHOT = {
  name: "Jordan Reyes",
  email: "jordan@summitrealtygroup.com",
  brokerage: "Summit Realty Group",
  teamSize: "1 lead agent, 1 transaction coordinator, 1 showing assistant",
  activeTransactions: "8-10 at a time",
  currentMethod: "Spreadsheet plus a shared inbox, with a lot tracked in my head",
  stress: "Keeping track of inspection deadlines and repair negotiations across multiple deals at once. I sometimes find out a deadline is tomorrow instead of next week.",
  time: "Chasing documents from lenders and title companies, and re-explaining the same status updates to clients who haven't heard from us in a few days.",
};

const SAMPLE_FUTURE_STATE = {
  automate: "Client status updates at each milestone, document request reminders, and the post-close review request.",
  delegate: "Scheduling inspections and showings, and the first round of document collection from clients.",
  eliminate: "Manually re-typing the same closing checklist into every new transaction.",
  stress: "Not knowing whether a deadline was actually hit until someone asks about it.",
  bottlenecks: "Waiting on the lender for a clear-to-close update, and waiting on title for the preliminary report.",
  timeSavings: "A standardized communication cadence so clients stop needing to ask what's happening.",
};

const SAMPLE_STAGE_DATA = {
  "Under Contract": {
    purpose: "Lock in the agreement and get every deadline clock started correctly.",
    entry: "Fully executed purchase agreement received from all parties.",
    exit: "Earnest money deposited and contract logged into the transaction system.",
    delays: "Buyer is slow to wire earnest money, or a signature page is missing.",
    risk: "Missing the earnest money deadline, which can put the contract at risk.",
    tasks: [
      { id: "t1", name: "Submit Earnest Money Deposit", description: "Confirm buyer has wired or delivered the deposit.", trigger: "Within 3 days of effective date", owner: "Buyer", requirement: "Required" },
      { id: "t2", name: "Open Title File", description: "Send contract to title company to open the file.", trigger: "Within 1 day of effective date", owner: "Transaction Coordinator", requirement: "Required" },
      { id: "t3", name: "Calendar All Deadlines", description: "Log inspection, financing, and closing deadlines.", trigger: "Same day as effective date", owner: "Transaction Coordinator", requirement: "Required" },
    ],
    documents: [
      { id: "d1", name: "Fully Executed Purchase Agreement", collectedBy: "Realtor", reviewedBy: "Transaction Coordinator", storedWhere: "Transaction folder, Google Drive", accessNeeded: "Realtor, TC, Title Company" },
      { id: "d2", name: "Earnest Money Receipt", collectedBy: "Title Company", reviewedBy: "Transaction Coordinator", storedWhere: "Transaction folder, Google Drive", accessNeeded: "Realtor, TC" },
    ],
    communications: [
      { id: "c1", question: "What happens now that we're under contract?", update: "Welcome message outlining the timeline and next steps.", sender: "Realtor", timing: "Within 24 hours of going under contract", method: "Email" },
    ],
  },
  "Inspection": {
    purpose: "Identify property condition issues and negotiate any necessary repairs.",
    entry: "Earnest money confirmed and inspector scheduled.",
    exit: "Inspection objection deadline passed with resolution documented.",
    delays: "Inspector availability, or slow responses on repair requests.",
    risk: "Missing the objection deadline, which forfeits the right to negotiate repairs.",
    tasks: [
      { id: "t4", name: "Schedule Inspection", description: "Coordinate access and book the inspector.", trigger: "Within 2 days of effective date", owner: "Transaction Coordinator", requirement: "Required" },
      { id: "t5", name: "Review Inspection Report", description: "Walk through findings with the client.", trigger: "Within 1 day of receiving report", owner: "Realtor", requirement: "Required" },
      { id: "t6", name: "Submit Repair Requests", description: "Draft and send any negotiated repair items.", trigger: "Before objection deadline", owner: "Realtor", requirement: "Optional" },
    ],
    documents: [
      { id: "d3", name: "Inspection Report", collectedBy: "Inspector", reviewedBy: "Realtor, Client", storedWhere: "Transaction folder, Google Drive", accessNeeded: "Realtor, Client, TC" },
      { id: "d4", name: "Repair Addendum", collectedBy: "Realtor", reviewedBy: "Both Parties", storedWhere: "Transaction folder, Google Drive", accessNeeded: "Realtor, TC, Title Company" },
    ],
    communications: [
      { id: "c2", question: "When will I get the report?", update: "Notify client as soon as the report is delivered.", sender: "Transaction Coordinator", timing: "Same day report is received", method: "Text" },
      { id: "c3", question: "Can we negotiate repairs?", update: "Explain objection rights and recommended next steps.", sender: "Realtor", timing: "Within 1 day of report review", method: "Phone" },
    ],
  },
  "Financing": {
    purpose: "Confirm the buyer's loan is on track toward clear-to-close.",
    entry: "Inspection contingency resolved.",
    exit: "Loan conditions cleared and appraisal accepted.",
    delays: "Appraisal scheduling, or buyer slow to submit requested documents to lender.",
    risk: "Low appraisal value or financing falling through close to the closing date.",
    tasks: [
      { id: "t7", name: "Confirm Appraisal Scheduled", description: "Check in with lender on appraisal timing.", trigger: "Within 5 days of effective date", owner: "Lender", requirement: "Required" },
      { id: "t8", name: "Track Loan Conditions", description: "Follow up weekly on outstanding underwriting items.", trigger: "Weekly until clear-to-close", owner: "Transaction Coordinator", requirement: "Required" },
    ],
    documents: [
      { id: "d5", name: "Appraisal Report", collectedBy: "Lender", reviewedBy: "Realtor", storedWhere: "Transaction folder, Google Drive", accessNeeded: "Realtor, TC" },
      { id: "d6", name: "Loan Approval Letter", collectedBy: "Lender", reviewedBy: "Transaction Coordinator", storedWhere: "Transaction folder, Google Drive", accessNeeded: "Realtor, TC, Title Company" },
    ],
    communications: [
      { id: "c4", question: "Is the loan on track?", update: "Weekly financing status update.", sender: "Transaction Coordinator", timing: "Every Friday until clear-to-close", method: "Email" },
    ],
  },
  "Title": {
    purpose: "Confirm clean, insurable title ahead of closing.",
    entry: "Title file opened and preliminary search underway.",
    exit: "Title commitment issued with no unresolved exceptions.",
    delays: "Liens or judgments that need to be cleared before closing.",
    risk: "A title issue discovered too close to the closing date to resolve in time.",
    tasks: [
      { id: "t9", name: "Review Preliminary Title Report", description: "Check for liens, easements, or exceptions.", trigger: "Within 2 days of receipt", owner: "Transaction Coordinator", requirement: "Required" },
    ],
    documents: [
      { id: "d7", name: "Preliminary Title Report", collectedBy: "Title Company", reviewedBy: "Transaction Coordinator", storedWhere: "Transaction folder, Google Drive", accessNeeded: "Realtor, TC" },
      { id: "d8", name: "Title Commitment", collectedBy: "Title Company", reviewedBy: "Realtor, Client", storedWhere: "Transaction folder, Google Drive", accessNeeded: "Realtor, TC, Client" },
    ],
    communications: [
      { id: "c5", question: "Is there anything wrong with the title?", update: "Confirm title is clear or flag any issues found.", sender: "Transaction Coordinator", timing: "Within 3 days of receiving the report", method: "Email" },
    ],
  },
  "Pre-Closing": {
    purpose: "Finalize all remaining items before the closing appointment.",
    entry: "Clear-to-close received from lender.",
    exit: "Final walkthrough completed and closing documents reviewed.",
    delays: "Scheduling conflicts for the final walkthrough.",
    risk: "Discovering a property condition issue at the final walkthrough.",
    tasks: [
      { id: "t10", name: "Schedule Final Walkthrough", description: "Coordinate timing with both parties.", trigger: "3 days before closing", owner: "Realtor", requirement: "Required" },
      { id: "t11", name: "Confirm Closing Figures", description: "Review closing disclosure with client.", trigger: "1 day before closing", owner: "Realtor", requirement: "Required" },
    ],
    documents: [
      { id: "d9", name: "Closing Disclosure", collectedBy: "Lender", reviewedBy: "Realtor, Client", storedWhere: "Transaction folder, Google Drive", accessNeeded: "Realtor, Client" },
    ],
    communications: [
      { id: "c6", question: "What do I need to bring to closing?", update: "Send closing day checklist and what to expect.", sender: "Transaction Coordinator", timing: "2 days before closing", method: "Email" },
    ],
  },
  "Closing": {
    purpose: "Complete the transaction and hand over the keys.",
    entry: "Final walkthrough completed with no open issues.",
    exit: "Documents signed, funds disbursed, and keys transferred.",
    delays: "Wire transfer delays or last-minute document corrections.",
    risk: "Funding delay that pushes the closing past the scheduled date.",
    tasks: [
      { id: "t12", name: "Confirm Funding", description: "Verify funds have been received and disbursed.", trigger: "Day of closing", owner: "Title Company", requirement: "Required" },
      { id: "t13", name: "Send Closing Day Summary", description: "Recap the transaction and next steps for the client.", trigger: "Same day as closing", owner: "Realtor", requirement: "Required" },
    ],
    documents: [
      { id: "d10", name: "Recorded Deed", collectedBy: "Title Company", reviewedBy: "Realtor", storedWhere: "Transaction folder, Google Drive", accessNeeded: "Realtor, Client" },
    ],
    communications: [
      { id: "c7", question: "Is everything finalized?", update: "Closing day summary and post-close follow-up plan.", sender: "Realtor", timing: "Same day as closing", method: "Email" },
    ],
  },
};

const LOGO_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAIAAAD2HxkiAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAEAAElEQVR42uy9eZxdZ3EmXE+97zn39i6p1dolW7Zsyxve8YoBg1nMvgUCk3VC8s2XQJKZYbIymXyZLMNMJpPJMhlIgLAEAoSwBQirjQGD932RZGvfpd7vds5bVd8f7zn33m51S7LUtkWi8+ufadS3b5/7nrfeqnrqqadgZnT6On2dvp67i08vwenr9HXaCE9fp6/TRnj6On2dvk4b4enr9HXaCE9fp6/T12kjPH2dvk4b4enr9HX6Om2Ep6/T17+6y59egq5Lu75HN4kB7f/MuMqXGGa+dH7+g818EzyrH8+6/qYd/Y8fncEBO77fROdTg4hs5s9wesOVy3maMTPfzsPRXmhdr8LC/Ek8px8bx/1iHOdS2MyPx6fiZz9thKec2R1toZ6hGzAzMjIyM5iZqamZiqiqzbhgRmbxH4lMjSg+Oys/RceYgG7XDJT/EL9lAGAiZoDBYAIcMzi+EERkMKD9ZtG6info/OsCrHO3/f/rtcN/5eHo8Tx4E9MQVERVNNqGhqCqEkjUVFQkz/M8BMmyVqvVyvM8y3IRkRBaWR7yICKiKiKiJuWVieZqKhpEQsglmIgEEQkhSJAgampGqmJamKiWV2mKpqZaWnPb5sCI2ztaVNu6zAwMxw4AAwwCM4OZ4b33ifPOg5kBBzh27Nh7n/ok8ZwkSeJ9kqQ+QZq6SqXivU/TSqWS+MQnSeKc88455xLvvffMLkkS712SuiRx3js4xKu4zZOMIU4b4Y9w2qcmIqZqZkEsBGk0mvV6Y3p6ut5oZVmeZZmItLK80cqbrWaj0Wg2ms1m3myEZrPRbDazPKu3mlme55m0miGPFiPR0FREzUhNJYiKqFLh0aKLI2s7NC1dWvtquzUQLDrJbtcDUPtfu7avYoZTMWt7LCreAV0GSWi7X5CZEeKvoAgeQSAGEaNwnOSYGcTROJ2L/xit2nnnHZjhnPfOgZF4pGlaSStJmlTTSrVSqVbTJHU9PWl/b7W3t6en2pOmaSVNenvSgf7+/v7+vr7eNE0qqU+SxHmfpmmauEolYf7Xgho+1+GodX0XN4l18v6ufzoOrxW3s5Ko5UEajeb01HStXs81z3NpNlr1enNycnp0dHJyarJWq9Wma5P11nS91WjUm81mq5W1csqyEEIQCa08BNFoVUZExmZspm0zaG/3GE6iHaOBiawTramZGcDMICJilMY241XUFUmWy9JlQHOGsceDknQvs9msd7NoSQARRQdbGh66YmVqOy8jAwCDqalpfCzMUFUjc+xKzCfaNrqyQiUiZosu1znnmFN2iffOuUql0tOT9vakPb29PT3V/r7+/r7KQF/PYH/f0EDf4EBfpbfS398/tKh/YKCvp1pJfeodO++8d977Y28vK28f3QntrORWiJieI+f8nOeEMwBJLZdgrsUwIjXjoNZsNOtTtVar1Wxl9UZrdHzy0Ojk+Ph4rVZr1OtT9Vat3pyampqanJqu1VuZZFnIsrzVzLMgOVHMuFRVJVpCEaopF9/H/9teHMQcqnRLptreqWaGLtQPcRczovWR [truncated]";

/* ============================================================
   SHARED UI PRIMITIVES
   ============================================================ */

function GlobalStyle(): JSX.Element {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');
      * { box-sizing: border-box; }
      .ds-app { font-family: ${FONT_BODY}; color: ${COLORS.text}; background: ${COLORS.bg}; }
      .ds-app input, .ds-app textarea, .ds-app select {
        font-family: ${FONT_BODY};
        font-size: 14px;
        color: ${COLORS.text};
        border: 1.5px solid ${COLORS.line};
        border-radius: 8px;
        padding: 10px 12px;
        background: ${COLORS.white};
        outline: none;
        transition: border-color 0.15s ease;
        width: 100%;
      }
      .ds-app input:focus, .ds-app textarea:focus, .ds-app select:focus {
        border-color: ${COLORS.secondary};
        box-shadow: 0 0 0 3px ${COLORS.accent};
      }
      .ds-app button { font-family: ${FONT_BODY}; cursor: pointer; }
      .ds-app button:focus-visible, .ds-app input:focus-visible, .ds-app a:focus-visible {
        outline: 2px solid ${COLORS.secondary};
        outline-offset: 2px;
      }
      @media print {
        .no-print { display: none !important; }
        .print-page { page-break-after: always; }
        body { background: white !important; }
      }
      @media (prefers-reduced-motion: reduce) {
        .ds-app * { transition: none !important; animation: none !important; }
      }
      .ds-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
      .ds-scroll::-webkit-scrollbar-thumb { background: ${COLORS.line}; border-radius: 4px; }
    `}</style>
  );
}

type ButtonProps = {
  children?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  style?: React.CSSProperties;
  type?: 'button' | 'submit' | 'reset';
};

function PrimaryButton({ children, onClick, disabled, style, type = 'button' }: ButtonProps): JSX.Element {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? '#9CA8B5' : COLORS.primary,
        color: COLORS.white,
        border: 'none',
        borderRadius: 8,
        padding: '13px 28px',
        fontWeight: 700,
        fontSize: 15,
        letterSpacing: '0.2px',
        boxShadow: disabled ? 'none' : '0 2px 8px rgba(15,76,129,0.25)',
        transition: 'transform 0.12s ease, box-shadow 0.12s ease, background 0.15s ease',
        ...style,
      }}
      onMouseEnter={(e) => { if (!disabled) { (e.currentTarget as HTMLButtonElement).style.background = COLORS.secondary; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; } }}
      onMouseLeave={(e) => { if (!disabled) { (e.currentTarget as HTMLButtonElement).style.background = COLORS.primary; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; } }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, style }: Omit<ButtonProps, 'disabled' | 'type'>): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        color: COLORS.primary,
        border: `1.5px solid ${COLORS.primary}`,
        borderRadius: 8,
        padding: '12px 26px',
        fontWeight: 600,
        fontSize: 15,
        transition: 'background 0.15s ease',
        ...style,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = COLORS.accent; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}

type GhostIconButtonProps = {
  children?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  title?: string;
  color?: string;
};

function GhostIconButton({ children, onClick, title, color }: GhostIconButtonProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'transparent',
        border: 'none',
        color: color || COLORS.textMuted,
        fontSize: 13,
        fontWeight: 600,
        padding: '4px 8px',
        borderRadius: 6,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = COLORS.bg; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}

type FieldProps = { label?: string; hint?: string; children?: React.ReactNode };

function Field({ label, hint, children }: FieldProps): JSX.Element {
  return (
    <div style={{ marginBottom: 18 }}>
      {label && (
        <label style={{ display: 'block', fontWeight: 600, fontSize: 13.5, marginBottom: 6, color: COLORS.text }}>
          {label}
        </label>
      )}
      {children}
      {hint && <div style={{ fontSize: 12.5, color: COLORS.textMuted, marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

type CalloutBoxProps = { children?: React.ReactNode; label?: string };

function CalloutBox({ children, label = 'Insight' }: CalloutBoxProps): JSX.Element {
  return (
    <div
      style={{
        background: COLORS.accent,
        borderLeft: `4px solid ${COLORS.secondary}`,
        borderRadius: 8,
        padding: '18px 22px',
        margin: '28px 0',
      }}
    >
      <div style={{ fontFamily: FONT_HEAD, fontSize: 11, fontWeight: 700, letterSpacing: '1px', color: COLORS.primary, textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 15.5, lineHeight: 1.6, color: COLORS.navy, fontWeight: 500 }}>
        {children}
      </div>
    </div>
  );
}

function SectionEyebrow({ children }: { children?: React.ReactNode }): JSX.Element {
  return (
    <div style={{ fontFamily: FONT_HEAD, fontSize: 12, fontWeight: 700, letterSpacing: '1.5px', color: COLORS.secondary, textTransform: 'uppercase', marginBottom: 10 }}>
      {children}
    </div>
  );
}

function PageTitle({ children }: { children?: React.ReactNode }): JSX.Element {
  return (
    <h1 style={{ fontFamily: FONT_HEAD, fontSize: 32, fontWeight: 800, color: COLORS.navy, margin: '0 0 14px', lineHeight: 1.2 }}>
      {children}
    </h1>
  );
}

function PageSubtitle({ children }: { children?: React.ReactNode }): JSX.Element {
  return (
    <p style={{ fontSize: 16.5, color: COLORS.textMuted, lineHeight: 1.6, margin: '0 0 32px', maxWidth: 680 }}>
      {children}
    </p>
  );
}

function ProgressBar({ step, total }: { step: number; total: number }): JSX.Element {
  const pct = Math.round((step / (total - 1)) * 100);
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.textMuted }}>
          Step {step} of {total - 1}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.secondary }}>{pct}% complete</span>
      </div>
      <div style={{ height: 6, background: COLORS.line, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${COLORS.secondary}, ${COLORS.primary})`, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  );
}

type StepNavProps = {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;
  hideBack?: boolean;
};

function StepNav({ onBack, onNext, nextLabel = 'Continue', backLabel = 'Back', nextDisabled, hideBack }: StepNavProps): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, paddingTop: 24, borderTop: `1px solid ${COLORS.line}` }}>
      {!hideBack ? <SecondaryButton onClick={onBack}>{backLabel}</SecondaryButton> : <div />}
      <PrimaryButton onClick={onNext} disabled={nextDisabled}>{nextLabel}</PrimaryButton>
    </div>
  );
}

/* ============================================================
   APP SHELL
   ============================================================ */

function TopBar({ logo }: { logo: string }): JSX.Element {
  return (
    <div
      className="no-print"
      style={{
        background: COLORS.white,
        borderBottom: `1px solid ${COLORS.line}`,
        padding: '14px 28px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      <img src={logo} alt="DoorScale" style={{ width: 34, height: 34, borderRadius: 7 }} />
      <div style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 16, color: COLORS.navy, letterSpacing: '0.2px' }}>
        DoorScale
      </div>
      <div style={{ width: 1, height: 18, background: COLORS.line, margin: '0 6px' }} />
      <div style={{ fontSize: 13, color: COLORS.textMuted, fontWeight: 500 }}>
        Realtor Transaction Blueprint
      </div>
    </div>
  );
}

function Shell({ children, logo, step, total, showProgress = true }: { children?: React.ReactNode; logo: string; step: number; total: number; showProgress?: boolean }): JSX.Element {
  return (
    <div className="ds-app" style={{ minHeight: '100%' }}>
      <GlobalStyle />
      <TopBar logo={logo} />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '44px 24px 80px' }}>
        {showProgress && (
          <div className="no-print" style={{ marginBottom: 36 }}>
            <ProgressBar step={step} total={total} />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/* ============================================================
   LANDING PAGE
   ============================================================ */

function LandingPage({ logo, onStart, onSeeSample }: { logo: string; onStart: () => void; onSeeSample: () => void }): JSX.Element {
  return (
    <div className="ds-app" style={{ minHeight: '100%' }}>
      <GlobalStyle />
      <TopBar logo={logo} />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '80px 24px 100px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-block', fontFamily: FONT_HEAD, fontSize: 12, fontWeight: 700,
          letterSpacing: '1.5px', color: COLORS.secondary, textTransform: 'uppercase',
          background: COLORS.accent, padding: '7px 16px', borderRadius: 20, marginBottom: 24
        }}>
          A Blueprint Builder for Real Estate Operators
        </div>
        <h1 style={{ fontFamily: FONT_HEAD, fontSize: 42, fontWeight: 800, color: COLORS.navy, lineHeight: 1.18, margin: '0 0 20px' }}>
          The Realtor Transaction Blueprint
        </h1>
        <p style={{ fontSize: 18, color: COLORS.textMuted, lineHeight: 1.65, maxWidth: 560, margin: '0 auto 40px' }}>
          Build a documented transaction process you can scale, delegate, automate, or hand off to a transaction coordinator.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 56 }}>
          <PrimaryButton onClick={onStart} style={{ padding: '15px 32px', fontSize: 16 }}>
            Start Building My Blueprint
          </PrimaryButton>
          <SecondaryButton onClick={onSeeSample} style={{ padding: '14px 30px', fontSize: 16 }}>
            See Sample Blueprint
          </SecondaryButton>
        </div>

        <div style={{ borderTop: `1px solid ${COLORS.line}`, paddingTop: 44, textAlign: 'left' }}>
          <SectionEyebrow>What this is</SectionEyebrow>
          <p style={{ fontSize: 15.5, color: COLORS.text, lineHeight: 1.7, marginBottom: 28 }}>
            Most Realtors don't need more leads. They need better systems around the opportunities they already have.
            This is a guided exercise that walks you through documenting your transaction process from contract to
            close — your stages, your tasks, your documents, your communication, and who owns each piece of it.
            What you build here is yours to keep, whether or not you ever use DoorScale.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            {[
              ['Not a CRM', "This doesn't manage your contacts or your pipeline of leads."],
              ['Not a sales funnel', "Nothing here is designed to extract a sale from you."],
              ['Not a transaction management system', "It's the blueprint you'd hand to one."],
              ['A planning workshop', 'Twenty minutes of focused thinking about how you actually work.'],
            ].map(([t, d]) => (
              <div key={String(t)} style={{ background: COLORS.white, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: '16px 18px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.navy, marginBottom: 4 }}>{t}</div>
                <div style={{ fontSize: 13.5, color: COLORS.textMuted, lineHeight: 1.5 }}>{d}</div>
              </div>
            ))}
          </div>

          <CalloutBox label="Worth sitting with">
            Many Realtors discover that large parts of their "process" exist only in memory — not in any system at all.
          </CalloutBox>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   STEP 1 — TRANSACTION SNAPSHOT
   ============================================================ */

function StepSnapshot({ data, setData, onNext, onBack }: { data: Snapshot; setData: React.Dispatch<React.SetStateAction<Snapshot>>; onNext?: () => void; onBack?: () => void }): JSX.Element {
  const update = (k: keyof Snapshot, v: string) => setData((d) => ({ ...d, [k]: v }));
  const valid = Boolean(data.name && data.email);

  return (
    <div>
      <SectionEyebrow>Step 1 of 9</SectionEyebrow>
      <PageTitle>Transaction Snapshot</PageTitle>
      <PageSubtitle>
        Before we map anything, let's get an honest picture of where things stand today.
      </PageSubtitle>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Name">
          <input value={data.name} onChange={(e) => update("name", e.target.value)} placeholder="Jane Smith" />
        </Field>
        <Field label="Email">
          <input value={data.email} onChange={(e) => update("email", e.target.value)} placeholder="jane@brokerage.com" type="email" />
        </Field>
        <Field label="Brokerage">
          <input value={data.brokerage} onChange={(e) => update("brokerage", e.target.value)} placeholder="Brokerage name" />
        </Field>
        <Field label="Team Size">
          <input value={data.teamSize} onChange={(e) => update("teamSize", e.target.value)} placeholder="e.g., Just me, 3 agents, 8 agents + TC" />
        </Field>
        <Field label="Active Transactions (typical)">
          <input value={data.activeTransactions} onChange={(e) => update("activeTransactions", e.target.value)} placeholder="e.g., 6-10 at a time" />
        </Field>
        <Field label="Current Transaction Management Method">
          <input value={data.currentMethod} onChange={(e) => update("currentMethod", e.target.value)} placeholder="e.g., Spreadsheet + memory" />
        </Field>
      </div>

      <Field label="What part of your transaction process creates the most stress?">
        <textarea rows={3} value={data.stress} onChange={(e) => update("stress", e.target.value)} placeholder="Write a few sentences..." />
      </Field>
      <Field label="What part consumes the most time?">
        <textarea rows={3} value={data.time} onChange={(e) => update("time", e.target.value)} placeholder="Write a few sentences..." />
      </Field>

      <StepNav onBack={onBack} onNext={onNext} nextDisabled={!valid} hideBack />
    </div>
  );
}

/* ============================================================
   STEP 2 — PIPELINE BUILDER
   ============================================================ */

function StepPipeline({ stages, setStages, onNext, onBack }: { stages: string[]; setStages: React.Dispatch<React.SetStateAction<string[]>>; onNext?: () => void; onBack?: () => void }): JSX.Element {
  const [newStage, setNewStage] = useState<string>("");

  const addStage = () => {
    const name = newStage.trim();
    if (!name || stages.includes(name)) return;
    setStages((s) => [...s, name]);
    setNewStage("");
  };

  const removeStage = (idx: number) => {
    setStages((s) => s.filter((_, i) => i !== idx));
  };

  const renameStage = (idx: number, val: string) => {
    setStages((s) => s.map((x, i) => (i === idx ? val : x)));
  };

  const move = (idx: number, dir: number) => {
    setStages((s) => {
      const arr = [...s];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  };

  return (
    <div>
      <SectionEyebrow>Step 2 of 9</SectionEyebrow>
      <PageTitle>Pipeline Builder</PageTitle>
      <PageSubtitle>
        Map the stages a transaction moves through, from the moment you go under contract to the moment it closes.
        Reorder, rename, add, or remove stages until it matches how you actually work.
      </PageSubtitle>

      {/* Visual pipeline */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 36 }}>
        {stages.map((s, i) => (
          <React.Fragment key={i}>
            <div style={{
              background: COLORS.primary, color: COLORS.white, borderRadius: 8,
              padding: "10px 16px", fontSize: 13.5, fontWeight: 700, fontFamily: FONT_HEAD,
              whiteSpace: "nowrap",
            }}>
              {s || "Untitled Stage"}
            </div>
            {i < stages.length - 1 && (
              <div style={{ alignSelf: "center", color: COLORS.secondary, fontSize: 16 }}>&rarr;</div>
            )}
          </React.Fragment>
        ))}
      </div>

      <div style={{ background: COLORS.white, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 20 }}>
        {stages.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 24, textAlign: "center", color: COLORS.textMuted, fontSize: 12, fontWeight: 700 }}>{i + 1}</div>
            <input value={s} onChange={(e) => renameStage(i, e.target.value)} style={{ flex: 1 }} />
            <GhostIconButton onClick={() => move(i, -1)} title="Move up">&uarr;</GhostIconButton>
            <GhostIconButton onClick={() => move(i, 1)} title="Move down">&darr;</GhostIconButton>
            <GhostIconButton onClick={() => removeStage(i)} title="Remove" color="#C0392B">Remove</GhostIconButton>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <input
            value={newStage}
            onChange={(e) => setNewStage(e.target.value)}
            placeholder="Add a custom stage (e.g., Escrow, Appraisal)"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStage(); } }}
          />
          <SecondaryButton onClick={addStage} style={{ padding: "10px 18px", fontSize: 13.5, whiteSpace: "nowrap" }}>
            Add Stage
          </SecondaryButton>
        </div>
      </div>

      <CalloutBox label="Insight">
        There's no universal pipeline. The right number of stages is whatever number makes each handoff in your
        business visible and accountable — not too coarse to be useful, not so granular it becomes busywork.
      </CalloutBox>

      <StepNav onBack={onBack} onNext={onNext} nextDisabled={stages.length === 0 || stages.some((s) => !s.trim())} />
    </div>
  );
}

/* ============================================================
   STAGE SUB-NAV (used in steps 3-6)
   ============================================================ */

function StageTabs({ stages, activeIdx, setActiveIdx }: { stages: string[]; activeIdx: number; setActiveIdx: (i: number) => void }): JSX.Element {
  return (
    <div className="ds-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 28, paddingBottom: 4 }}>
      {stages.map((s, i) => (
        <button
          key={i}
          onClick={() => setActiveIdx(i)}
          style={{
            whiteSpace: 'nowrap',
            padding: '8px 14px',
            borderRadius: 7,
            border: `1.5px solid ${i === activeIdx ? COLORS.primary : COLORS.line}`,
            background: i === activeIdx ? COLORS.primary : COLORS.white,
            color: i === activeIdx ? COLORS.white : COLORS.text,
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

/* ============================================================
   STEP 3 — STAGE PLANNER
   ============================================================ */

function StepStagePlanner({ stages, stageData, setStageData, onNext, onBack }: { stages: string[]; stageData: StageDataMap; setStageData: React.Dispatch<React.SetStateAction<StageDataMap>>; onNext?: () => void; onBack?: () => void }): JSX.Element {
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const stageName = stages[activeIdx];
  const current: StageData = stageData[stageName] || { purpose: '', entry: '', exit: '', delays: '', risk: '', tasks: [], documents: [], communications: [] };

  const update = (field: keyof StageData, val: string) => {
    setStageData((d) => ({ ...d, [stageName]: { ...d[stageName], [field]: val } }));
  };

  return (
    <div>
      <SectionEyebrow>Step 3 of 9</SectionEyebrow>
      <PageTitle>Stage Planner</PageTitle>
      <PageSubtitle>
        Define what actually defines each stage — not just its name, but its boundaries and its risks.
      </PageSubtitle>

      <StageTabs stages={stages} activeIdx={activeIdx} setActiveIdx={setActiveIdx} />

      <div style={{ background: COLORS.white, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 26 }}>
        <h3 style={{ fontFamily: FONT_HEAD, fontSize: 19, fontWeight: 700, color: COLORS.navy, margin: "0 0 18px" }}>
          {stageName}
        </h3>
        <Field label="What is the purpose of this stage?">
          <textarea rows={2} value={current.purpose || ""} onChange={(e) => update("purpose", e.target.value)} placeholder="What is this stage meant to accomplish?" />
        </Field>
        <Field label="What must happen before entering this stage?" hint="Entry criteria">
          <textarea rows={2} value={current.entry || ""} onChange={(e) => update("entry", e.target.value)} placeholder="e.g., Fully executed contract received" />
        </Field>
        <Field label="What determines completion?" hint="Exit criteria">
          <textarea rows={2} value={current.exit || ""} onChange={(e) => update("exit", e.target.value)} placeholder="e.g., Inspection objection deadline passed" />
        </Field>
        <Field label="What commonly causes delays here?">
          <textarea rows={2} value={current.delays || ""} onChange={(e) => update("delays", e.target.value)} placeholder="e.g., Waiting on third-party scheduling" />
        </Field>
        <Field label="What is the biggest risk during this stage?">
          <textarea rows={2} value={current.risk || ""} onChange={(e) => update("risk", e.target.value)} placeholder="e.g., Missed deadline could void the contract" />
        </Field>
      </div>

      {activeIdx === 0 && (
        <CalloutBox label="Insight">
          Entry and exit criteria are what make a stage a stage. If you can't say precisely when one ends and the
          next begins, neither can anyone you delegate to.
        </CalloutBox>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
        <SecondaryButton
          onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
          style={{ visibility: activeIdx === 0 ? "hidden" : "visible", padding: "9px 18px", fontSize: 13.5 }}
        >
          &larr; Previous Stage
        </SecondaryButton>
        <SecondaryButton
          onClick={() => setActiveIdx((i) => Math.min(stages.length - 1, i + 1))}
          style={{ visibility: activeIdx === stages.length - 1 ? "hidden" : "visible", padding: "9px 18px", fontSize: 13.5 }}
        >
          Next Stage &rarr;
        </SecondaryButton>
      </div>

      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  );
}

/* ============================================================
   STEP 4 — TASK CHECKLIST BUILDER
   ============================================================ */

function TaskRow({ task, onChange, onRemove }: { task: Task; onChange: (t: Task) => void; onRemove?: () => void }): JSX.Element {
  return (
    <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <input
          value={task.name}
          onChange={(e) => onChange({ ...task, name: e.target.value })}
          placeholder="Task name (e.g., Submit Earnest Money Deposit)"
          style={{ flex: 1, fontWeight: 600 }}
        />
        <GhostIconButton onClick={onRemove} title="Remove task" color="#C0392B">Remove</GhostIconButton>
      </div>
      <textarea
        value={task.description}
        onChange={(e) => onChange({ ...task, description: e.target.value })}
        placeholder="Description (optional)"
        rows={2}
        style={{ marginBottom: 10 }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <input
          value={task.trigger}
          onChange={(e) => onChange({ ...task, trigger: e.target.value })}
          placeholder="Due date trigger (e.g., Within 3 days)"
        />
        <select value={task.owner} onChange={(e) => onChange({ ...task, owner: e.target.value })}>
          <option value="">Responsible party...</option>
          {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={task.requirement} onChange={(e) => onChange({ ...task, requirement: e.target.value })}>
          <option value="">Required / Optional...</option>
          {REQUIRED_OPT.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    </div>
  );
}

function StepTasks({ stages, stageData, setStageData, onNext, onBack }: { stages: string[]; stageData: StageDataMap; setStageData: React.Dispatch<React.SetStateAction<StageDataMap>>; onNext?: () => void; onBack?: () => void }): JSX.Element {
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const stageName = stages[activeIdx];
  const tasks: Task[] = (stageData[stageName] && stageData[stageName].tasks) || [];

  const setTasks = (newTasks: Task[]) => {
    setStageData((d) => ({ ...d, [stageName]: { ...d[stageName], tasks: newTasks } }));
  };

  const addTask = () => {
    setTasks([...tasks, { id: uid(), name: '', description: '', trigger: '', owner: '', requirement: 'Required' }]);
  };

  return (
    <div>
      <SectionEyebrow>Step 4 of 9</SectionEyebrow>
      <PageTitle>Task Checklist Builder</PageTitle>
      <PageSubtitle>
        For each stage, list every task that has to happen. Be specific about who owns it and what triggers the deadline.
      </PageSubtitle>

      <StageTabs stages={stages} activeIdx={activeIdx} setActiveIdx={setActiveIdx} />

      <h3 style={{ fontFamily: FONT_HEAD, fontSize: 18, fontWeight: 700, color: COLORS.navy, margin: '0 0 14px' }}>
        {stageName} — Tasks
      </h3>

      {tasks.length === 0 && (
        <div style={{ color: COLORS.textMuted, fontSize: 14, fontStyle: 'italic', marginBottom: 14 }}>
          No tasks added yet for this stage.
        </div>
      )}

      {tasks.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          onChange={(updated) => setTasks(tasks.map((x) => (x.id === t.id ? updated : x)))}
          onRemove={() => setTasks(tasks.filter((x) => x.id !== t.id))}
        />
      ))}

      <SecondaryButton onClick={addTask} style={{ padding: '10px 20px', fontSize: 13.5 }}>
        + Add Task
      </SecondaryButton>

      {activeIdx === 0 && tasks.length === 0 && (
        <CalloutBox label="Example">
          Submit Earnest Money Deposit — Responsible Party: Buyer — Trigger: Within 3 Days of Effective Date.
        </CalloutBox>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <SecondaryButton
          onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
          style={{ visibility: activeIdx === 0 ? 'hidden' : 'visible', padding: '9px 18px', fontSize: 13.5 }}
        >
          &larr; Previous Stage
        </SecondaryButton>
        <SecondaryButton
          onClick={() => setActiveIdx((i) => Math.min(stages.length - 1, i + 1))}
          style={{ visibility: activeIdx === stages.length - 1 ? 'hidden' : 'visible', padding: '9px 18px', fontSize: 13.5 }}
        >
          Next Stage &rarr;
        </SecondaryButton>
      </div>

      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  );
}

/* ============================================================
   STEP 5 — DOCUMENT CHECKLIST BUILDER
   ============================================================ */

function DocRow({ doc, onChange, onRemove }: { doc: DocItem; onChange: (d: DocItem) => void; onRemove?: () => void }): JSX.Element {
  return (
    <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <input
          value={doc.name}
          onChange={(e) => onChange({ ...doc, name: e.target.value })}
          placeholder="Document name (e.g., Inspection Report)"
          style={{ flex: 1, fontWeight: 600 }}
        />
        <GhostIconButton onClick={onRemove} title="Remove document" color="#C0392B">Remove</GhostIconButton>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <input value={doc.collectedBy} onChange={(e) => onChange({ ...doc, collectedBy: e.target.value })} placeholder="Who collects it?" />
        <input value={doc.reviewedBy} onChange={(e) => onChange({ ...doc, reviewedBy: e.target.value })} placeholder="Who reviews it?" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <input value={doc.storedWhere} onChange={(e) => onChange({ ...doc, storedWhere: e.target.value })} placeholder="Where is it stored?" />
        <input value={doc.accessNeeded} onChange={(e) => onChange({ ...doc, accessNeeded: e.target.value })} placeholder="Who needs access?" />
      </div>
    </div>
  );
}

function StepDocuments({ stages, stageData, setStageData, onNext, onBack }: { stages: string[]; stageData: StageDataMap; setStageData: React.Dispatch<React.SetStateAction<StageDataMap>>; onNext?: () => void; onBack?: () => void }): JSX.Element {
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const stageName = stages[activeIdx];
  const docs: DocItem[] = (stageData[stageName] && stageData[stageName].documents) || [];

  const setDocs = (newDocs: DocItem[]) => {
    setStageData((d) => ({ ...d, [stageName]: { ...d[stageName], documents: newDocs } }));
  };

  const addDoc = () => {
    setDocs([...docs, { id: uid(), name: '', collectedBy: '', reviewedBy: '', storedWhere: '', accessNeeded: '' }]);
  };

  return (
    <div>
      <SectionEyebrow>Step 5 of 9</SectionEyebrow>
      <PageTitle>Document Checklist Builder</PageTitle>
      <PageSubtitle>
        Map the paperwork. For each stage, name the documents required and exactly how they move through your system.
      </PageSubtitle>

      <StageTabs stages={stages} activeIdx={activeIdx} setActiveIdx={setActiveIdx} />

      <h3 style={{ fontFamily: FONT_HEAD, fontSize: 18, fontWeight: 700, color: COLORS.navy, margin: '0 0 14px' }}>
        {stageName} — Documents
      </h3>

      {docs.length === 0 && (
        <div style={{ color: COLORS.textMuted, fontSize: 14, fontStyle: 'italic', marginBottom: 14 }}>
          No documents added yet for this stage.
        </div>
      )}

      {docs.map((d) => (
        <DocRow
          key={d.id}
          doc={d}
          onChange={(updated) => setDocs(docs.map((x) => (x.id === d.id ? updated : x)))}
          onRemove={() => setDocs(docs.filter((x) => x.id !== d.id))}
        />
      ))}

      <SecondaryButton onClick={addDoc} style={{ padding: '10px 20px', fontSize: 13.5 }}>
        + Add Document
      </SecondaryButton>

      {activeIdx === 0 && (
        <CalloutBox label="Insight">
          "Storage location" and "who needs access" feel obvious until a deal moves fast and three people are
          searching three different places for the same form.
        </CalloutBox>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <SecondaryButton
          onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
          style={{ visibility: activeIdx === 0 ? 'hidden' : 'visible', padding: '9px 18px', fontSize: 13.5 }}
        >
          &larr; Previous Stage
        </SecondaryButton>
        <SecondaryButton
          onClick={() => setActiveIdx((i) => Math.min(stages.length - 1, i + 1))}
          style={{ visibility: activeIdx === stages.length - 1 ? 'hidden' : 'visible', padding: '9px 18px', fontSize: 13.5 }}
        >
          Next Stage &rarr;
        </SecondaryButton>
      </div>

      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  );
}

/* ============================================================
   STEP 6 — COMMUNICATION BLUEPRINT
   ============================================================ */

function CommRow({ comm, onChange, onRemove }: { comm: CommItem; onChange: (c: CommItem) => void; onRemove?: () => void }): JSX.Element {
  return (
    <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <input
          value={comm.question}
          onChange={(e) => onChange({ ...comm, question: e.target.value })}
          placeholder='Common client question (e.g., "When will I get the report?")'
          style={{ flex: 1, fontWeight: 600 }}
        />
        <GhostIconButton onClick={onRemove} title="Remove" color="#C0392B">Remove</GhostIconButton>
      </div>
      <input
        value={comm.update}
        onChange={(e) => onChange({ ...comm, update: e.target.value })}
        placeholder="What update should they receive?"
        style={{ marginBottom: 10 }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <select value={comm.sender} onChange={(e) => onChange({ ...comm, sender: e.target.value })}>
          <option value="">Who sends it?</option>
          {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <input value={comm.timing} onChange={(e) => onChange({ ...comm, timing: e.target.value })} placeholder="When should it be sent?" />
        <select value={comm.method} onChange={(e) => onChange({ ...comm, method: e.target.value })}>
          <option value="">Delivery method...</option>
          {DELIVERY.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    </div>
  );
}

function StepCommunication({ stages, stageData, setStageData, onNext, onBack }: { stages: string[]; stageData: StageDataMap; setStageData: React.Dispatch<React.SetStateAction<StageDataMap>>; onNext?: () => void; onBack?: () => void }): JSX.Element {
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const stageName = stages[activeIdx];
  const comms: CommItem[] = (stageData[stageName] && stageData[stageName].communications) || [];

  const setComms = (newComms: CommItem[]) => {
    setStageData((d) => ({ ...d, [stageName]: { ...d[stageName], communications: newComms } }));
  };

  const addComm = () => {
    setComms([...comms, { id: uid(), question: '', update: '', sender: '', timing: '', method: '' }]);
  };

  return (
    <div>
      <SectionEyebrow>Step 6 of 9</SectionEyebrow>
      <PageTitle>Communication Blueprint</PageTitle>
      <PageSubtitle>
        Clients get anxious when they don't know what's happening — not because the transaction is complicated.
        Plan the updates before the deal is moving fast.
      </PageSubtitle>

      <StageTabs stages={stages} activeIdx={activeIdx} setActiveIdx={setActiveIdx} />

      <h3 style={{ fontFamily: FONT_HEAD, fontSize: 18, fontWeight: 700, color: COLORS.navy, margin: '0 0 14px' }}>
        {stageName} — Communication Plan
      </h3>

      {comms.length === 0 && (
        <div style={{ color: COLORS.textMuted, fontSize: 14, fontStyle: 'italic', marginBottom: 14 }}>
          No communication items added yet for this stage.
        </div>
      )}

      {comms.map((c) => (
        <CommRow
          key={c.id}
          comm={c}
          onChange={(updated) => setComms(comms.map((x) => (x.id === c.id ? updated : x)))}
          onRemove={() => setComms(comms.filter((x) => x.id !== c.id))}
        />
      ))}

      <SecondaryButton onClick={addComm} style={{ padding: '10px 20px', fontSize: 13.5 }}>
        + Add Communication Item
      </SecondaryButton>

      {stageName.toLowerCase().includes('inspect') && comms.length === 0 && (
        <CalloutBox label="Example — Inspection Stage">
          Common questions: "What happens next?" "When will I get the report?" "Can we negotiate repairs?"
        </CalloutBox>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <SecondaryButton
          onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
          style={{ visibility: activeIdx === 0 ? 'hidden' : 'visible', padding: '9px 18px', fontSize: 13.5 }}
        >
          &larr; Previous Stage
        </SecondaryButton>
        <SecondaryButton
          onClick={() => setActiveIdx((i) => Math.min(stages.length - 1, i + 1))}
          style={{ visibility: activeIdx === stages.length - 1 ? 'hidden' : 'visible', padding: '9px 18px', fontSize: 13.5 }}
        >
          Next Stage &rarr;
        </SecondaryButton>
      </div>

      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  );
}

/* ============================================================
   STEP 7 — RESPONSIBILITY MATRIX
   ============================================================ */

function StepResponsibility({ stages, stageData, onNext, onBack }: { stages: string[]; stageData: StageDataMap; onNext?: () => void; onBack?: () => void }): JSX.Element {
  // Aggregate all tasks across all stages into one matrix
  const allRows: { stage: string; task: string; owner: string }[] = [];
  stages.forEach((stageName) => {
    const tasks = (stageData[stageName] && stageData[stageName].tasks) || [];
    tasks.forEach((t) => {
      if (t.name.trim()) {
        allRows.push({ stage: stageName, task: t.name, owner: t.owner || 'Unassigned' });
      }
    });
  });

  const ownerCounts: Record<string, number> = {};
  allRows.forEach((r) => { ownerCounts[r.owner] = (ownerCounts[r.owner] || 0) + 1; });

  return (
    <div>
      <SectionEyebrow>Step 7 of 9</SectionEyebrow>
      <PageTitle>Responsibility Matrix</PageTitle>
      <PageSubtitle>
        This is built automatically from the tasks you defined in Step 4. Use it to spot imbalance — who is
        carrying too much, and what's still unassigned.
      </PageSubtitle>

      {allRows.length === 0 ? (
        <div style={{ background: COLORS.white, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 30, textAlign: "center", color: COLORS.textMuted }}>
          No tasks were added in Step 4 yet. Go back and add tasks to populate your responsibility matrix.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 28 }}>
            {Object.entries(ownerCounts).map(([owner, count]) => (
              <div key={owner} style={{
                background: owner === "Unassigned" ? "#FDECEC" : COLORS.accent,
                border: `1px solid ${owner === "Unassigned" ? "#F0B7B7" : "#BBD9F2"}`,
                borderRadius: 8, padding: "10px 16px", minWidth: 130
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FONT_HEAD, color: owner === "Unassigned" ? "#C0392B" : COLORS.primary }}>{count}</div>
                <div style={{ fontSize: 12.5, color: COLORS.textMuted, fontWeight: 600 }}>{owner}</div>
              </div>
            ))}
          </div>

          <div style={{ background: COLORS.white, border: `1px solid ${COLORS.line}`, borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ background: COLORS.primary }}>
                  <th style={{ textAlign: "left", padding: "12px 16px", color: COLORS.white, fontWeight: 700, fontFamily: FONT_HEAD, fontSize: 12.5, letterSpacing: "0.5px" }}>STAGE</th>
                  <th style={{ textAlign: "left", padding: "12px 16px", color: COLORS.white, fontWeight: 700, fontFamily: FONT_HEAD, fontSize: 12.5, letterSpacing: "0.5px" }}>TASK</th>
                  <th style={{ textAlign: "left", padding: "12px 16px", color: COLORS.white, fontWeight: 700, fontFamily: FONT_HEAD, fontSize: 12.5, letterSpacing: "0.5px" }}>OWNER</th>
                </tr>
              </thead>
              <tbody>
                {allRows.map((r, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? COLORS.white : COLORS.bg, borderTop: `1px solid ${COLORS.line}` }}>
                    <td style={{ padding: "11px 16px", fontWeight: 600, color: COLORS.navy }}>{r.stage}</td>
                    <td style={{ padding: "11px 16px", color: COLORS.text }}>{r.task}</td>
                    <td style={{ padding: "11px 16px" }}>
                      <span style={{
                        background: r.owner === "Unassigned" ? "#FDECEC" : COLORS.accent,
                        color: r.owner === "Unassigned" ? "#C0392B" : COLORS.primary,
                        padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700
                      }}>
                        {r.owner}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {ownerCounts["Unassigned"] && (
            <CalloutBox label="Flag">
              {ownerCounts["Unassigned"]} task{ownerCounts["Unassigned"] > 1 ? "s" : ""} still have no owner.
              An unassigned task is the most common place a transaction quietly stalls.
            </CalloutBox>
          )}
        </>
      )}

      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  );
}

/* ============================================================
   STEP 8 — FUTURE STATE PLANNING
   ============================================================ */

function StepFutureState({ data, setData, onNext, onBack }: { data: FutureState; setData: React.Dispatch<React.SetStateAction<FutureState>>; onNext?: () => void; onBack?: () => void }): JSX.Element {
  const update = (k: keyof FutureState, v: string) => setData((d) => ({ ...d, [k]: v }));

  const questions: Array<[keyof FutureState, string]> = [
    ['automate', 'What would you automate?'],
    ['delegate', 'What would you delegate?'],
    ['eliminate', 'What would you eliminate?'],
    ['stress', 'What creates the most stress?'],
    ['bottlenecks', 'What creates the most bottlenecks?'],
    ['timeSavings', 'What would save the most time?'],
  ];

  return (
    <div>
      <SectionEyebrow>Step 8 of 9</SectionEyebrow>
      <PageTitle>Future State Planning</PageTitle>
      <PageSubtitle>
        You've documented how things work today. Now name what you'd change if you were designing this process
        from scratch.
      </PageSubtitle>

      {questions.map(([key, label]) => (
        <Field key={key} label={label}>
          <textarea rows={2} value={data[key] || ""} onChange={(e) => update(key, e.target.value)} placeholder="Write a few sentences..." />
        </Field>
      ))}

      <CalloutBox label="Worth sitting with">
        Most of what you just listed isn't a hiring problem. It's a systems problem — and systems are something
        you can design on purpose, instead of discovering by accident.
      </CalloutBox>

      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  );
}

/* ============================================================
   STEP 9 — LEAD CAPTURE (GHL EMBED)
   ============================================================ */

function StepLeadCapture({ onUnlock, onBack }: { onUnlock?: () => void; onBack?: () => void }): JSX.Element {
  return (
    <div>
      <SectionEyebrow>Step 9 of 9</SectionEyebrow>
      <PageTitle>Get Your Blueprint</PageTitle>
      <PageSubtitle>
        Enter your details to unlock your completed blueprint summary and save a copy as a PDF.
      </PageSubtitle>

      <div style={{ background: COLORS.white, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 28, marginBottom: 24 }}>
        {/*
          ───────────────────────────────────────────────────────────
          GHL EMBED GOES HERE
          Replace this placeholder with your GoHighLevel form embed
          (iframe or script snippet). On successful GHL form submission,
          call onUnlock() — e.g. by listening for GHL's postMessage event,
          or by wiring a button below to fire after the embed loads.

          Example (iframe embed):
          <iframe src="https://your-ghl-form-url" style={{ width: "100%", minHeight: 480, border: "none" }} />
          ───────────────────────────────────────────────────────────
        */}
        <div style={{
          border: `2px dashed ${COLORS.line}`, borderRadius: 10, padding: '40px 24px',
          textAlign: 'center', color: COLORS.textMuted, fontSize: 14, marginBottom: 20
        }}>
          <div style={{ fontWeight: 700, color: COLORS.navy, marginBottom: 8, fontFamily: FONT_HEAD }}>
            GHL Form Embed Placeholder
          </div>
          Drop your GoHighLevel form embed code here. On submit, your blueprint will be tagged and synced automatically.
        </div>

        <PrimaryButton onClick={onUnlock} style={{ width: '100%' }}>
          Continue to My Blueprint
        </PrimaryButton>
      </div>

      <StepNav onBack={onBack} onNext={onUnlock} nextLabel="Continue to My Blueprint" />
    </div>
  );
}

/* ============================================================
   BLUEPRINT SUMMARY / RESULTS PAGE
   ============================================================ */

function SummarySection({ title, children }: { title: string; children?: React.ReactNode }): JSX.Element {
  return (
    <div style={{ marginBottom: 36 }} className="print-page">
      <h2 style={{ fontFamily: FONT_HEAD, fontSize: 22, fontWeight: 800, color: COLORS.navy, margin: "0 0 16px", borderBottom: `2px solid ${COLORS.accent}`, paddingBottom: 10 }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function MiniTable({ headers, rows }: { headers: string[]; rows: Array<Array<string | undefined | null>> }): JSX.Element {
  if (rows.length === 0) return <div style={{ color: COLORS.textMuted, fontSize: 13.5, fontStyle: 'italic' }}>None recorded.</div>;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 18 }}>
      <thead>
        <tr style={{ background: COLORS.primary }}>
          {headers.map((h) => (
            <th key={h} style={{ textAlign: "left", padding: "9px 12px", color: COLORS.white, fontWeight: 700, fontFamily: FONT_HEAD, fontSize: 11.5, letterSpacing: "0.4px" }}>
              {h.toUpperCase()}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? COLORS.white : COLORS.bg, borderTop: `1px solid ${COLORS.line}` }}>
            {r.map((c, j) => (
              <td key={j} style={{ padding: "9px 12px", color: COLORS.text, verticalAlign: "top" }}>{c || "—"}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BlueprintSummary({ logo, snapshot, stages, stageData, futureState, onRestart }: { logo: string; snapshot: Snapshot; stages: string[]; stageData: StageDataMap; futureState: FutureState; onRestart: () => void }): JSX.Element {
  const printRef = useRef<HTMLDivElement | null>(null);

  const handlePrint = () => {
    window.print();
  };

  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  // Aggregate responsibility rows again for the summary
  const allTaskRows: { stage: string; task: string; owner: string }[] = [];
  stages.forEach((stageName) => {
    const tasks = (stageData[stageName] && stageData[stageName].tasks) || [];
    tasks.forEach((t) => {
      if (t.name.trim()) allTaskRows.push({ stage: stageName, task: t.name, owner: t.owner || 'Unassigned' });
    });
  });

  return (
    <div className="ds-app" style={{ minHeight: "100%" }}>
      <GlobalStyle />
      <div className="no-print">
        <TopBar logo={logo} />
      </div>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "40px 24px 100px" }} ref={printRef}>
        {/* Header / cover block */}
        <div style={{ textAlign: "center", marginBottom: 44 }} className="print-page">
          <img src={logo} alt="DoorScale" style={{ width: 64, height: 64, borderRadius: 12, marginBottom: 18 }} />
          <div style={{ fontFamily: FONT_HEAD, fontSize: 12, fontWeight: 700, letterSpacing: "2px", color: COLORS.secondary, textTransform: "uppercase", marginBottom: 14 }}>
            DoorScale
          </div>
          <h1 style={{ fontFamily: FONT_HEAD, fontSize: 36, fontWeight: 800, color: COLORS.navy, margin: "0 0 12px" }}>
            The Realtor Transaction Blueprint
          </h1>
          <p style={{ fontSize: 16, color: COLORS.textMuted, margin: "0 0 28px" }}>
            Document, Organize, and Standardize Your Transaction Process Before It Starts Managing You
          </p>
          <div style={{ display: "inline-flex", gap: 28, fontSize: 13.5, color: COLORS.text, borderTop: `1px solid ${COLORS.line}`, borderBottom: `1px solid ${COLORS.line}`, padding: "12px 28px" }}>
            <div><strong>Prepared for:</strong> {snapshot.name || "—"}</div>
            <div><strong>Brokerage:</strong> {snapshot.brokerage || "—"}</div>
            <div><strong>Date:</strong> {today}</div>
          </div>
        </div>

        <div className="no-print" style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 40 }}>
          <PrimaryButton onClick={handlePrint}>Download / Print PDF</PrimaryButton>
          <SecondaryButton onClick={onRestart}>Start a New Blueprint</SecondaryButton>
        </div>

        <div className="no-print" style={{ marginBottom: 8 }}>
          <h2 style={{ fontFamily: FONT_HEAD, fontSize: 24, fontWeight: 800, color: COLORS.navy }}>
            Your Transaction Blueprint Is Ready
          </h2>
          <p style={{ fontSize: 15.5, color: COLORS.textMuted, lineHeight: 1.6, maxWidth: 640 }}>
            Most Realtors never take the time to document their transaction process. You now have a blueprint that
            can be delegated, automated, and systemized.
          </p>
        </div>

        {/* Snapshot */}
        <SummarySection title="Transaction Snapshot">
          <MiniTable
            headers={["Field", "Response"]}
            rows={[
              ["Team Size", snapshot.teamSize],
              ["Active Transactions", snapshot.activeTransactions],
              ["Current Method", snapshot.currentMethod],
              ["Biggest Stress Point", snapshot.stress],
              ["Most Time-Consuming Part", snapshot.time],
            ]}
          />
        </SummarySection>

        {/* Pipeline */}
        <SummarySection title="Transaction Pipeline">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {stages.map((s, i) => (
              <React.Fragment key={i}>
                <div style={{ background: COLORS.primary, color: COLORS.white, borderRadius: 7, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, fontFamily: FONT_HEAD }}>
                  {s}
                </div>
                {i < stages.length - 1 && <div style={{ alignSelf: "center", color: COLORS.secondary }}>&rarr;</div>}
              </React.Fragment>
            ))}
          </div>
        </SummarySection>

        {/* Stage definitions */}
        <SummarySection title="Stage Definitions">
          {stages.map((s) => {
            const sd = stageData[s] || {};
            return (
              <div key={s} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${COLORS.line}` }}>
                <div style={{ fontWeight: 700, color: COLORS.navy, fontSize: 14.5, marginBottom: 6 }}>{s}</div>
                <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.6 }}>
                  {sd.purpose && <div><strong>Purpose:</strong> {sd.purpose}</div>}
                  {sd.entry && <div><strong>Entry criteria:</strong> {sd.entry}</div>}
                  {sd.exit && <div><strong>Exit criteria:</strong> {sd.exit}</div>}
                  {sd.delays && <div><strong>Common delays:</strong> {sd.delays}</div>}
                  {sd.risk && <div><strong>Biggest risk:</strong> {sd.risk}</div>}
                </div>
              </div>
            );
          })}
        </SummarySection>

        {/* Tasks */}
        <SummarySection title="Task Checklists">
          {stages.map((s) => {
            const tasks = (stageData[s] && stageData[s].tasks) || [];
            if (tasks.length === 0) return null;
            return (
              <div key={s} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: COLORS.navy, fontSize: 13.5, marginBottom: 6 }}>{s}</div>
                <MiniTable
                  headers={["Task", "Trigger", "Owner", "Required?"]}
                  rows={tasks.filter((t) => t.name.trim()).map((t) => [t.name, t.trigger, t.owner, t.requirement])}
                />
              </div>
            );
          })}
        </SummarySection>

        {/* Documents */}
        <SummarySection title="Document Blueprint">
          {stages.map((s) => {
            const docs = (stageData[s] && stageData[s].documents) || [];
            if (docs.length === 0) return null;
            return (
              <div key={s} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: COLORS.navy, fontSize: 13.5, marginBottom: 6 }}>{s}</div>
                <MiniTable
                  headers={["Document", "Collected By", "Reviewed By", "Stored Where", "Access"]}
                  rows={docs.filter((d) => d.name.trim()).map((d) => [d.name, d.collectedBy, d.reviewedBy, d.storedWhere, d.accessNeeded])}
                />
              </div>
            );
          })}
        </SummarySection>

        {/* Communication */}
        <SummarySection title="Communication Blueprint">
          {stages.map((s) => {
            const comms = (stageData[s] && stageData[s].communications) || [];
            if (comms.length === 0) return null;
            return (
              <div key={s} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: COLORS.navy, fontSize: 13.5, marginBottom: 6 }}>{s}</div>
                <MiniTable
                  headers={["Client Question", "Update Sent", "Sender", "Timing", "Method"]}
                  rows={comms.filter((c) => (c.question || "").trim() || (c.update || "").trim()).map((c) => [c.question || "", c.update || "", c.sender, c.timing, c.method])}
                />
              </div>
            );
          })}
        </SummarySection>

        {/* Responsibility matrix */}
        <SummarySection title="Responsibility Matrix">
          <MiniTable
            headers={["Stage", "Task", "Owner"]}
            rows={allTaskRows.map((r) => [r.stage, r.task, r.owner])}
          />
        </SummarySection>

        {/* Future state */}
        <SummarySection title="Future State Goals">
          <MiniTable
            headers={["Question", "Response"]}
            rows={[
              ["What would you automate?", futureState.automate],
              ["What would you delegate?", futureState.delegate],
              ["What would you eliminate?", futureState.eliminate],
              ["What creates the most stress?", futureState.stress],
              ["What creates the most bottlenecks?", futureState.bottlenecks],
              ["What would save the most time?", futureState.timeSavings],
            ]}
          />
        </SummarySection>

        {/* Closing / DoorScale intro */}
        <div className="print-page" style={{ marginTop: 50, paddingTop: 36, borderTop: `2px solid ${COLORS.accent}`, textAlign: "center" }}>
          <p style={{ fontSize: 15, color: COLORS.text, lineHeight: 1.7, maxWidth: 620, margin: "0 auto 24px" }}>
            You've just done what most Realtors never get around to: put your entire transaction process into one
            document. That alone makes it easier to delegate, easier to train someone new, and easier to spot where
            things break down before they do.
          </p>
          <p style={{ fontSize: 15, color: COLORS.text, lineHeight: 1.7, maxWidth: 620, margin: "0 auto 32px" }}>
            DoorScale's Transaction Management System was built specifically to help Realtors implement a blueprint
            like the one you just created — turning these stages, tasks, and communication plans into a system that
            runs itself.
          </p>
          <div className="no-print">
            <PrimaryButton
              onClick={() => window.open("https://doorscale.com/tc-system", "_blank")}
              style={{ padding: "15px 32px", fontSize: 15.5 }}
            >
              Join the Founding Member Waitlist
            </PrimaryButton>
          </div>
          <div style={{ marginTop: 28, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 15, color: COLORS.navy, fontStyle: "italic" }}>
            "Clarity creates consistency. Consistency creates scalability."
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { margin: 0.6in; }
          .ds-app { background: white; }
        }
      `}</style>
    </div>
  );
}

/* ============================================================
   MAIN APP
   ============================================================ */

export default function RealtorTransactionBlueprint(): JSX.Element {
  const [screen, setScreen] = useState<string>("landing"); // landing | wizard | summary
  const [step, setStep] = useState<number>(1); // 1-9 within wizard

  const [snapshot, setSnapshot] = useState<Snapshot>({
    name: '', email: '', brokerage: '', teamSize: '', activeTransactions: '',
    currentMethod: '', stress: '', time: '',
  });

  const [stages, setStages] = useState<string[]>([...DEFAULT_STAGES]);
  const [stageData, setStageData] = useState<StageDataMap>(() => emptyStageData(DEFAULT_STAGES));
  const [futureState, setFutureState] = useState<FutureState>({
    automate: '', delegate: '', eliminate: '', stress: '', bottlenecks: '', timeSavings: '',
  });

  // Keep stageData in sync if stages array changes (add/remove/rename)
  const syncStageData = (newStages: string[] | ((prev: string[]) => string[])) => {
    setStages((prevStages) => {
      const resolved = typeof newStages === 'function' ? (newStages as (prev: string[]) => string[])(prevStages) : newStages;
      setStageData((old) => {
        const next: StageDataMap = {};
        resolved.forEach((s) => {
          next[s] = old[s] || { purpose: '', entry: '', exit: '', delays: '', risk: '', tasks: [], documents: [], communications: [] };
        });
        return next;
      });
      return resolved;
    });
  };

  const TOTAL_STEPS = 9;

  const goNext = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const restart = () => {
    setScreen("landing");
    setStep(1);
    setSnapshot({ name: "", email: "", brokerage: "", teamSize: "", activeTransactions: "", currentMethod: "", stress: "", time: "" });
    setStages([...DEFAULT_STAGES]);
    setStageData(emptyStageData(DEFAULT_STAGES));
    setFutureState({ automate: "", delegate: "", eliminate: "", stress: "", bottlenecks: "", timeSavings: "" });
  };

  const loadSample = () => {
    setSnapshot(SAMPLE_SNAPSHOT);
    setStages([...SAMPLE_STAGES]);
    setStageData(SAMPLE_STAGE_DATA);
    setFutureState(SAMPLE_FUTURE_STATE);
    setScreen("summary");
  };

  if (screen === "landing") {
    return <LandingPage logo={LOGO_B64} onStart={() => { setScreen("wizard"); setStep(1); }} onSeeSample={loadSample} />;
  }

  if (screen === "summary") {
    return (
      <BlueprintSummary
        logo={LOGO_B64}
        snapshot={snapshot}
        stages={stages}
        stageData={stageData}
        futureState={futureState}
        onRestart={restart}
      />
    );
  }

  // Wizard
  return (
    <Shell logo={LOGO_B64} step={step} total={TOTAL_STEPS + 1}>
      {step === 1 && (
        <StepSnapshot data={snapshot} setData={setSnapshot} onNext={goNext} onBack={goBack} />
      )}
      {step === 2 && (
        <StepPipeline stages={stages} setStages={syncStageData} onNext={goNext} onBack={goBack} />
      )}
      {step === 3 && (
        <StepStagePlanner stages={stages} stageData={stageData} setStageData={setStageData} onNext={goNext} onBack={goBack} />
      )}
      {step === 4 && (
        <StepTasks stages={stages} stageData={stageData} setStageData={setStageData} onNext={goNext} onBack={goBack} />
      )}
      {step === 5 && (
        <StepDocuments stages={stages} stageData={stageData} setStageData={setStageData} onNext={goNext} onBack={goBack} />
      )}
      {step === 6 && (
        <StepCommunication stages={stages} stageData={stageData} setStageData={setStageData} onNext={goNext} onBack={goBack} />
      )}
      {step === 7 && (
        <StepResponsibility stages={stages} stageData={stageData} onNext={goNext} onBack={goBack} />
      )}
      {step === 8 && (
        <StepFutureState data={futureState} setData={setFutureState} onNext={goNext} onBack={goBack} />
      )}
      {step === 9 && (
        <StepLeadCapture onUnlock={() => setScreen("summary")} onBack={goBack} />
      )}
    </Shell>
  );
}
