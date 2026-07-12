import { differenceInCalendarDays, format } from "date-fns";
import {
  ArrowLeft,
  CalendarClock,
  CheckSquare,
  ExternalLink,
  FileText,
  Pencil,
  StickyNote,
  Upload,
} from "lucide-react";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { EditTransactionModal } from "@/components/EditTransactionModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TaskItem } from "@/components/TaskItem";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TRANSACTION_STAGES,
  type DocumentStatus,
  type TransactionDocument,
  type TransactionStage,
  useCRMData,
} from "@/hooks/use-crm-data";
import {
  getDoorScaleLocationHeaders,
  getStoredActiveLocationId,
  getUrlActiveLocationId,
} from "@/lib/active-location";
import { formatCurrency } from "@/lib/utils";

const WORKSPACE_STAGES = [
  "Pre-listing",
  "Active",
  "Under Contract",
  "Inspections",
  "Appraisal",
  "Clear to Close",
  "Closed",
] as const;

type WorkspaceTab = "tasks" | "documents" | "notes";

const TEAM_ROLE_OPTIONS = [
  { label: "Involved Party", value: "involved_party_buyersellertenant" },
  { label: "Agent", value: "agent" },
  { label: "Lender", value: "lender" },
  { label: "Title/Escrow", value: "title_escrow" },
  { label: "Inspector", value: "inspector" },
  { label: "Attorney", value: "attorney" },
  { label: "Appraiser", value: "appraiser" },
  { label: "Insurance Agent", value: "insurance_agent" },
  { label: "Transaction Coordinator", value: "transaction_coordinator" },
  { label: "Other Transaction Contact", value: "other_transaction_contact" },
] as const;

type TeamRoleKey = (typeof TEAM_ROLE_OPTIONS)[number]["value"];
type TransactionAssociation = {
  id: string;
  associationId?: string;
  associationKey?: string;
  associationLabel: string;
  company: string;
  email: string;
  name: string;
  openUrl: string;
  phone: string;
  relationId?: string;
  role: string;
  type: "contact" | "company" | "property" | "unknown";
};

type TeamContactSearchResult = {
  company?: string;
  email: string;
  id: string;
  name: string;
  phone: string;
};

type TransactionAssociationsResponse = {
  association?: TransactionAssociation;
  associations?: TransactionAssociation[];
  contacts?: TeamContactSearchResult[];
  contactsByLabel?: Record<string, TransactionAssociation[]>;
  linkedOrganization?: TransactionAssociation | null;
  linkedProperty?: TransactionAssociation | null;
  objectKey?: string;
  objectRecordId?: string;
  ok?: boolean;
  message?: string;
};

const initialTaskForm = {
  assignedTo: "",
  description: "",
  dueDate: "",
  dueTime: "",
  status: "pending",
  title: "",
};

function statusLabel(status = "") {
  return status.replace(/_/g, " ");
}

function formatDate(dateValue: string) {
  const date = new Date(dateValue);

  if (!dateValue || Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return format(date, "MMM d, yyyy");
}

function getDaysUntilClosing(closingDate: string) {
  const date = new Date(closingDate);

  if (!closingDate || Number.isNaN(date.getTime())) {
    return "Not set";
  }

  const days = differenceInCalendarDays(date, new Date());

  if (days === 0) return "Closing today";
  if (days < 0) return `${Math.abs(days)} days past closing`;

  return `${days} days`;
}

function stageVariant(stage: string) {
  if (stage === "Clear to Close") return "success";
  if (stage === "Inspections" || stage === "Appraisal") return "warning";
  if (stage === "Closed") return "muted";
  if (stage === "Dead") return "danger";
  return "default";
}

function getSyncLabel(syncStatus = "synced") {
  if (syncStatus === "pending_sync") return "Pending";
  if (syncStatus === "sync_error" || syncStatus === "failed") return "Failed";
  return "Synced";
}

function getSyncVariant(syncStatus = "synced") {
  if (syncStatus === "pending_sync") return "warning";
  if (syncStatus === "sync_error" || syncStatus === "failed") return "danger";
  return "success";
}

function documentStatusVariant(status: string) {
  const normalizedStatus = normalizeDocumentStatus(status);

  if (
    normalizedStatus === "uploaded" ||
    normalizedStatus === "approved" ||
    normalizedStatus === "completed"
  ) {
    return "success";
  }
  if (normalizedStatus === "rejected" || normalizedStatus === "missing") {
    return "danger";
  }
  if (normalizedStatus === "pending_review") return "default";
  if (normalizedStatus === "sent") return "default";
  if (normalizedStatus === "viewed") return "default";
  return "warning";
}

function normalizeDocumentStatus(status = "Needed") {
  const normalizedStatus = status.trim().toLowerCase().replace(/\s+/g, "_");

  if (normalizedStatus === "completed") return "completed";
  if (normalizedStatus === "sent") return "sent";
  if (normalizedStatus === "viewed") return "viewed";
  if (normalizedStatus === "uploaded") return "uploaded";
  if (normalizedStatus === "pending_review") return "pending_review";
  if (normalizedStatus === "approved") return "approved";
  if (normalizedStatus === "rejected") return "rejected";
  if (normalizedStatus === "missing") return "missing";
  return "needed";
}

function formatDocumentStatus(status = "Needed") {
  const normalizedStatus = normalizeDocumentStatus(status);

  if (normalizedStatus === "completed") return "Completed";
  if (normalizedStatus === "sent") return "Sent";
  if (normalizedStatus === "viewed") return "Viewed";
  if (normalizedStatus === "uploaded") return "Uploaded";
  if (normalizedStatus === "pending_review") return "Pending Review";
  if (normalizedStatus === "approved") return "Approved";
  if (normalizedStatus === "rejected") return "Rejected";
  if (normalizedStatus === "missing") return "Missing";
  return "Needed";
}

function isWorkflowDocument(deliveryType = "") {
  return deliveryType === "workflow";
}

function buildDocumentViewLink(documentId: string, transactionId: string) {
  const params = new URLSearchParams({
    action: "view",
    document_id: documentId,
    transaction_id: transactionId,
    location_id: getUrlActiveLocationId() || getStoredActiveLocationId() || "",
  });

  return `/api/documents?${params.toString()}`;
}

function buildContactLink(locationId?: string, contactId?: string) {
  if (!locationId || !contactId) return "";

  return `https://app.gohighlevel.com/v2/location/${locationId}/contacts/detail/${contactId}`;
}

function buildOpportunityLink(locationId?: string, opportunityId?: string) {
  if (!locationId || !opportunityId) return "";

  return `https://app.gohighlevel.com/v2/location/${locationId}/opportunities/detail/${opportunityId}`;
}

export default function TransactionDetail() {
  const { id } = useParams();
  const data = useCRMData();
  const [stageMessage, setStageMessage] = useState("");
  const [stageError, setStageError] = useState("");
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [isTaskSubmitting, setIsTaskSubmitting] = useState(false);
  const [taskForm, setTaskForm] = useState(initialTaskForm);
  const [taskError, setTaskError] = useState("");
  const [isRetryingSync, setIsRetryingSync] = useState(false);
  const [detailMessage, setDetailMessage] = useState("");
  const [detailError, setDetailError] = useState("");
  const [uploadingDocumentId, setUploadingDocumentId] = useState("");
  const [manualDocumentName, setManualDocumentName] = useState("");
  const [renamingDocumentIds, setRenamingDocumentIds] = useState<string[]>([]);
  const [renameValues, setRenameValues] = useState<Record<string, string>>({});
  const [isPreparingDocuments, setIsPreparingDocuments] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [notesLoadedFor, setNotesLoadedFor] = useState("");
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>("tasks");
  const [transactionAssociations, setTransactionAssociations] =
    useState<TransactionAssociationsResponse>({});
  const [isLoadingAssociations, setIsLoadingAssociations] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [teamRoleKey, setTeamRoleKey] =
    useState<TeamRoleKey>("involved_party_buyersellertenant");
  const [teamSearchQuery, setTeamSearchQuery] = useState("");
  const [teamSearchResults, setTeamSearchResults] = useState<TeamContactSearchResult[]>([]);
  const [selectedTeamContact, setSelectedTeamContact] =
    useState<TeamContactSearchResult | null>(null);
  const [isSearchingTeamContacts, setIsSearchingTeamContacts] = useState(false);
  const [isSavingTeamAssociation, setIsSavingTeamAssociation] = useState(false);
  const [teamAssociationError, setTeamAssociationError] = useState("");
  const transaction = data.opportunities.find(
    (opp) => String(opp.id) === String(id),
  );
  const maybeTransactionId = transaction ? String(transaction.id) : "";
  const maybeActiveLocationId =
    getUrlActiveLocationId() ||
    getStoredActiveLocationId() ||
    transaction?.ghlLocationId ||
    "";
  const maybeTransactionType = transaction?.customFields.transactionType || "";
  const maybeCurrentStage = transaction?.stage || "";
  const transactionNotes = data.notes.filter(
    (note) => String(note.transactionId) === String(maybeTransactionId),
  );
  const transactionDocumentsForCurrentTransaction = data.documents.filter(
    (document) =>
      String(document.transactionId) === String(maybeTransactionId) &&
      String(document.locationId) === String(maybeActiveLocationId) &&
      Boolean(document.id),
  );

  useEffect(() => {
    let isMounted = true;

    async function prepareDocuments() {
      if (
        data.loading ||
        data.error ||
        !transaction ||
        !maybeTransactionId ||
        !maybeActiveLocationId
      ) {
        return;
      }

      setIsPreparingDocuments(true);

      try {
        await data.ensureTransactionDocuments({
          stage: maybeCurrentStage,
          transactionId: maybeTransactionId,
          transactionType: maybeTransactionType,
        });
      } finally {
        if (isMounted) {
          setIsPreparingDocuments(false);
        }
      }
    }

    void prepareDocuments();

    return () => {
      isMounted = false;
    };
  }, [
    data.error,
    data.ensureTransactionDocuments,
    data.loading,
    maybeActiveLocationId,
    maybeCurrentStage,
    maybeTransactionId,
    maybeTransactionType,
    transaction,
    transactionDocumentsForCurrentTransaction.length,
  ]);


  useEffect(() => {
    if (
      data.loading ||
      data.error ||
      !transaction ||
      !maybeTransactionId ||
      notesLoadedFor === maybeTransactionId
    ) {
      return;
    }

    let isMounted = true;
    setIsLoadingNotes(true);

    data.fetchTransactionNotes(maybeTransactionId)
      .catch((error) => {
        if (isMounted) {
          console.warn("DoorScale notes are still loading:", error);
        }
      })
      .finally(() => {
        if (isMounted) {
          setNotesLoadedFor(maybeTransactionId);
          setIsLoadingNotes(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    data.error,
    data.fetchTransactionNotes,
    data.loading,
    maybeTransactionId,
    notesLoadedFor,
    transaction,
  ]);

  async function handleAddNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!noteText.trim() || !maybeTransactionId) return;

    setDetailMessage("");
    setDetailError("");
    setIsSavingNote(true);

    try {
      const message = await data.createTransactionNote({
        body: noteText,
        transactionId: maybeTransactionId,
      });
      setNoteText("");
      setDetailMessage(message || "Note saved.");
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Unable to save note.");
    } finally {
      setIsSavingNote(false);
    }
  }

  useEffect(() => {
    if (
      data.loading ||
      data.error ||
      !transaction ||
      !maybeTransactionId ||
      !maybeActiveLocationId
    ) {
      return;
    }

    let isMounted = true;
    setIsLoadingAssociations(true);

    fetch("/api/ghl", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getDoorScaleLocationHeaders(maybeActiveLocationId),
      },
      body: JSON.stringify({
        action: "fetchTransactionAssociations",
        active_location_id: maybeActiveLocationId,
        locationId: maybeActiveLocationId,
        transactionId: maybeTransactionId,
      }),
    })
      .then(async (response) => {
        const result = (await response.json().catch(() => ({}))) as TransactionAssociationsResponse;
        if (!response.ok) {
          throw new Error(result.message || "Unable to load transaction team.");
        }
        console.log("DoorScale transaction associations loaded:", {
          associationLabels: Object.keys(result.contactsByLabel || {}),
          contactCount: Object.values(result.contactsByLabel || {}).flat().length,
          hasLinkedOrganization: Boolean(result.linkedOrganization),
          hasLinkedProperty: Boolean(result.linkedProperty),
          objectRecordId: result.objectRecordId || null,
        });
        if (isMounted) {
          setTransactionAssociations(result);
        }
      })
      .catch((error) => {
        console.warn("DoorScale transaction associations unavailable:", error);
        if (isMounted) {
          setTransactionAssociations({});
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingAssociations(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    data.error,
    data.loading,
    maybeActiveLocationId,
    maybeTransactionId,
    transaction,
  ]);

  function addAssociationToLocalState(association: TransactionAssociation) {
    setTransactionAssociations((current) => {
      const label = association.associationLabel || "Other Transaction Contact";
      const currentGroups = current.contactsByLabel || {};
      const existingGroup = currentGroups[label] || [];
      const duplicate = existingGroup.some(
        (item) =>
          item.id === association.id &&
          (item.associationKey || item.associationLabel) ===
            (association.associationKey || association.associationLabel),
      );

      if (duplicate) {
        return current;
      }

      return {
        ...current,
        associations: [...(current.associations || []), association],
        contactsByLabel: {
          ...currentGroups,
          [label]: [...existingGroup, association],
        },
      };
    });
  }

  function removeAssociationFromLocalState(relationId: string) {
    setTransactionAssociations((current) => {
      const nextGroups = Object.entries(current.contactsByLabel || {}).reduce<
        Record<string, TransactionAssociation[]>
      >((groups, [label, contacts]) => {
        const filtered = contacts.filter((contact) => contact.relationId !== relationId);
        if (filtered.length) {
          groups[label] = filtered;
        }
        return groups;
      }, {});

      return {
        ...current,
        associations: (current.associations || []).filter(
          (association) => association.relationId !== relationId,
        ),
        contactsByLabel: nextGroups,
      };
    });
  }

  async function handleSearchTeamContacts(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (!maybeActiveLocationId || teamSearchQuery.trim().length < 2) {
      setTeamSearchResults([]);
      return;
    }

    setTeamAssociationError("");
    setIsSearchingTeamContacts(true);

    try {
      const response = await fetch("/api/ghl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getDoorScaleLocationHeaders(maybeActiveLocationId),
        },
        body: JSON.stringify({
          action: "searchTransactionTeamContacts",
          active_location_id: maybeActiveLocationId,
          locationId: maybeActiveLocationId,
          query: teamSearchQuery,
          teamAction: "searchContacts",
        }),
      });
      const result = (await response.json().catch(() => ({}))) as TransactionAssociationsResponse;

      if (!response.ok) {
        throw new Error(result.message || "Unable to search contacts.");
      }

      setTeamSearchResults(result.contacts || []);
    } catch (error) {
      setTeamAssociationError(
        error instanceof Error ? error.message : "Unable to search contacts.",
      );
    } finally {
      setIsSearchingTeamContacts(false);
    }
  }

  async function handleAddTeamContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTeamContact || !maybeActiveLocationId || !maybeTransactionId) {
      setTeamAssociationError("Select a contact to add.");
      return;
    }

    setTeamAssociationError("");
    setIsSavingTeamAssociation(true);

    try {
      const response = await fetch("/api/ghl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getDoorScaleLocationHeaders(maybeActiveLocationId),
        },
        body: JSON.stringify({
          action: "addTransactionTeamContact",
          active_location_id: maybeActiveLocationId,
          companyName: selectedTeamContact.company || "",
          contactId: selectedTeamContact.id,
          locationId: maybeActiveLocationId,
          roleKey: teamRoleKey,
          teamAction: "addContactAssociation",
          transactionId: maybeTransactionId,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as TransactionAssociationsResponse;

      if (!response.ok || !result.association) {
        throw new Error(result.message || "Unable to add contact.");
      }

      addAssociationToLocalState(result.association);
      setIsTeamModalOpen(false);
      setSelectedTeamContact(null);
      setTeamSearchQuery("");
      setTeamSearchResults([]);
      setDetailMessage("Contact added to transaction team.");
    } catch (error) {
      setTeamAssociationError(error instanceof Error ? error.message : "Unable to add contact.");
    } finally {
      setIsSavingTeamAssociation(false);
    }
  }

  async function handleRemoveTeamAssociation(contact: TransactionAssociation) {
    if (!contact.relationId || !maybeActiveLocationId || !maybeTransactionId) {
      setDetailError("Association details are missing.");
      return;
    }

    setDetailMessage("");
    setDetailError("");

    try {
      const response = await fetch("/api/ghl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getDoorScaleLocationHeaders(maybeActiveLocationId),
        },
        body: JSON.stringify({
          action: "removeTransactionTeamAssociation",
          active_location_id: maybeActiveLocationId,
          locationId: maybeActiveLocationId,
          relationId: contact.relationId,
          teamAction: "removeAssociation",
          transactionId: maybeTransactionId,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as TransactionAssociationsResponse;

      if (!response.ok) {
        throw new Error(result.message || "Unable to remove contact.");
      }

      removeAssociationFromLocalState(contact.relationId);
      setDetailMessage("Contact removed from transaction team.");
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Unable to remove contact.");
    }
  }

  if (data.loading) {
    return (
      <div className="dashboard">
        <p className="dashboard__status">Loading DoorScale data...</p>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="dashboard">
        <p className="dashboard__error">{data.error}</p>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="dashboard">
        <Link className="back-link" to="/transactions">
          <ArrowLeft size={16} />
          Transactions
        </Link>
        <Card>
          <CardContent>
            <div className="empty-state">Transaction not found.</div>
            <div className="debug-panel">
              <strong>Debug</strong>
              <span>URL id: {id ?? "missing"}</span>
              <span>
                Available opportunity ids:{" "}
                {data.opportunities.length
                  ? data.opportunities.map((opp) => String(opp.id)).join(", ")
                  : "none"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fields = transaction.customFields;
  const transactionId = maybeTransactionId;
  const activeLocationId = maybeActiveLocationId;
  const transactionType = fields.transactionType;
  const currentStage = transaction.stage;
  const contactLink = buildContactLink(
    transaction.ghlLocationId,
    transaction.ghlContactId || transaction.contactId,
  );
  const opportunityLink = buildOpportunityLink(
    transaction.ghlLocationId,
    transaction.ghlOpportunityId,
  );
  const relatedTasks = data.tasks.filter(
    (task) =>
      String(task.relatedOpportunityId) === transactionId ||
      String(task.transactionId) === transactionId,
  );
  const transactionDocuments = transactionDocumentsForCurrentTransaction;
  const documentTrackingRows = transactionDocuments.map((document) => ({
    document,
    documentType: document.documentName || document.documentType,
  }));

  async function handleStageChange(stage: TransactionStage) {
    setStageMessage("");
    setStageError("");

    if (stage === currentStage) return;

    setIsUpdatingStage(true);

    try {
      const message = await data.updateTransactionStage({
        transactionId,
        transactionType,
        stage,
      });
      setStageMessage(message || "Stage updated.");
    } catch (error) {
      setStageError(
        error instanceof Error ? error.message : "Unable to update stage.",
      );
    } finally {
      setIsUpdatingStage(false);
    }
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTaskError("");
    setDetailMessage("");

    if (!taskForm.title.trim()) {
      setTaskError("Task title is required.");
      return;
    }

    setIsTaskSubmitting(true);

    try {
      const message = await data.createTask({
        assignedTo: taskForm.assignedTo.trim(),
        description: taskForm.description.trim(),
        dueDate: taskForm.dueDate,
        dueTime: taskForm.dueTime,
        status: taskForm.status,
        title: taskForm.title.trim(),
        transactionId,
      });
      setTaskForm(initialTaskForm);
      setIsTaskFormOpen(false);
      setDetailMessage(message || "Task saved.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save task.";
      if (message.includes("DoorScale sync will retry later")) {
        setDetailMessage(message);
        setTaskForm(initialTaskForm);
        setIsTaskFormOpen(false);
      } else {
        setTaskError(message);
      }
    } finally {
      setIsTaskSubmitting(false);
    }
  }

  async function handleRetryTransactionSync() {
    setDetailMessage("");
    setDetailError("");
    setIsRetryingSync(true);

    try {
      const message = await data.retryTransactionSync(transactionId);
      setDetailMessage(message || "Transaction synced.");
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "Unable to retry sync.",
      );
    } finally {
      setIsRetryingSync(false);
    }
  }

  async function handleDocumentStatusChange(
    documentRecord: TransactionDocument,
    status: string,
  ) {
    setDetailMessage("");
    setDetailError("");

    try {
      await data.updateDocumentStatus({
        documentId: documentRecord.id,
        status: status as DocumentStatus,
        transactionId,
      });
      setDetailMessage("Document status updated.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to update document status.";
      setDetailError(
        message,
      );
    }
  }

  async function handleDocumentUpload(
    documentId: string,
    documentType: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    console.log("Selected document file:", file.name);
    setDetailMessage("");
    setDetailError("");
    setUploadingDocumentId(documentId);

    try {
      await data.uploadTransactionDocument({
        documentId,
        documentType,
        file,
        transactionId,
      });
      setDetailMessage("Document uploaded.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to upload document.";
      setDetailError(message);
    } finally {
      setUploadingDocumentId("");
    }
  }

  function handleDocumentFileSelected(
    event: ChangeEvent<HTMLInputElement>,
    documentRecord: TransactionDocument,
  ) {
    const fileName = event.target.files?.[0]?.name || "none";
    console.log("Selected transaction document file:", {
      documentId: documentRecord.id,
      fileName,
      transactionId,
    });
    void handleDocumentUpload(
      documentRecord.id,
      documentRecord.documentType,
      event,
    );
  }

  async function handleManualDocumentFileSelected(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setDetailMessage("");
    setDetailError("");
    setUploadingDocumentId("manual");

    try {
      await data.uploadTransactionDocument({
        documentType: manualDocumentName.trim() || file.name || "Uploaded Document",
        file,
        transactionId,
      });
      setManualDocumentName("");
      setDetailMessage("Document uploaded.");
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "Unable to upload document.",
      );
    } finally {
      setUploadingDocumentId("");
    }
  }

  async function handleRenameDocument(documentRecord: TransactionDocument) {
    const documentName = (
      renameValues[documentRecord.id] ?? documentRecord.documentName
    ).trim();

    setDetailMessage("");
    setDetailError("");

    try {
      await data.renameTransactionDocument({
        documentId: documentRecord.id,
        documentName,
        transactionId,
      });
      setDetailMessage("Document renamed.");
      setRenamingDocumentIds((currentIds) =>
        currentIds.filter((id) => id !== documentRecord.id),
      );
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "Unable to rename document.",
      );
    }
  }

  const transactionNeedsSync =
    (transaction.syncStatus || "synced").toLowerCase() !== "synced" ||
    !transaction.ghlContactId ||
    !transaction.ghlOpportunityId ||
    Boolean(transaction.lastSyncError);

  const currentStageIndex = Math.max(
    WORKSPACE_STAGES.findIndex((stage) => stage === currentStage),
    0,
  );
  const primaryContactName =
    fields.contactName ||
    [fields.buyerName, fields.sellerName].filter(Boolean).join(" / ") ||
    "Primary contact not set";
  const primaryContactRole =
    fields.transactionType === "Buyer"
      ? "Buyer"
      : fields.transactionType === "Rental"
        ? "Rental client"
        : fields.transactionType === "Buyer/Seller"
          ? "Buyer / Seller"
          : "Seller";
  const propertyAddress = fields.propertyAddress || transaction.name || "Property not set";
  const associatedContactsByLabel: Record<string, TransactionAssociation[]> =
    transactionAssociations.contactsByLabel || {};
  const associatedContactCount = Object.values(associatedContactsByLabel).flat().length;
  const linkedOrganization = transactionAssociations.linkedOrganization;
  const linkedProperty = transactionAssociations.linkedProperty;

  return (
    <div className="dashboard transaction-workspace transaction-workspace--redesigned">
      <header className="workspace-hero">
        <div className="workspace-hero__main">
          <Link className="back-link" to="/transactions"><ArrowLeft size={16} />Back to Transactions</Link>
          <p className="dashboard__eyebrow">Transaction workspace</p>
          <h2>{propertyAddress}</h2>
          <div className="workspace-hero__badges"><Badge variant="default">{fields.transactionType || "Transaction type not set"}</Badge><Badge variant={stageVariant(transaction.stage)}>{transaction.stage as TransactionStage}</Badge><Badge variant={getSyncVariant(transaction.syncStatus)}>{getSyncLabel(transaction.syncStatus)}</Badge></div>
        </div>
        <div className="workspace-hero__actions" aria-label="Transaction actions">
          {contactLink ? <a className="button button--secondary" href={contactLink} rel="noreferrer" target="_blank"><ExternalLink size={17} />Open Contact</a> : <Button disabled variant="secondary"><ExternalLink size={17} />Contact not synced</Button>}
          {opportunityLink ? <a className="button button--secondary" href={opportunityLink} rel="noreferrer" target="_blank"><ExternalLink size={17} />Open Opportunity</a> : <Button disabled variant="secondary"><ExternalLink size={17} />Opportunity not synced</Button>}
          <Button onClick={() => { setDetailMessage(""); setDetailError(""); setIsEditOpen(true); }}><Pencil size={17} />Edit</Button>
          <Button onClick={() => { setTaskError(""); setIsTaskFormOpen((current) => !current); setActiveWorkspaceTab("tasks"); }}><CheckSquare size={17} />Add Task</Button>
          {transactionNeedsSync ? <Button disabled={isRetryingSync} onClick={() => void handleRetryTransactionSync()} variant="secondary">{isRetryingSync ? "Syncing..." : "Retry Sync"}</Button> : null}
        </div>
      </header>

      <section className="stage-timeline" aria-label="Transaction stage timeline">
        {WORKSPACE_STAGES.map((stage, index) => {
          const stageState = index < currentStageIndex ? "completed" : index === currentStageIndex ? "current" : "upcoming";
          return <button className={`stage-timeline__item stage-timeline__item--${stageState}`} disabled={isUpdatingStage || stage === currentStage} key={stage} onClick={() => void handleStageChange(stage)} type="button"><span>{index + 1}</span><strong>{stage}</strong></button>;
        })}
      </section>

      {stageMessage ? <p className="dashboard__success">{stageMessage}</p> : null}
      {stageError ? <p className="dashboard__error">{stageError}</p> : null}
      {detailMessage ? <p className="dashboard__success">{detailMessage}</p> : null}
      {detailError ? <p className="dashboard__error">{detailError}</p> : null}

      {isTaskFormOpen ? <Card><CardHeader><div><CardTitle>Add Task</CardTitle><CardDescription>Create a task for this transaction.</CardDescription></div></CardHeader><CardContent><form className="task-create-form" onSubmit={handleCreateTask}><label className="task-create-form__wide"><span>Title</span><input onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} required value={taskForm.title} /></label><label><span>Due date</span><input onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))} type="date" value={taskForm.dueDate} /></label><label><span>Due time</span><input onChange={(event) => setTaskForm((current) => ({ ...current, dueTime: event.target.value }))} type="time" value={taskForm.dueTime} /></label><label><span>Assigned to</span><input onChange={(event) => setTaskForm((current) => ({ ...current, assignedTo: event.target.value }))} value={taskForm.assignedTo} /></label><label><span>Status</span><select onChange={(event) => setTaskForm((current) => ({ ...current, status: event.target.value }))} value={taskForm.status}><option value="pending">Pending</option><option value="completed">Completed</option></select></label><label className="task-create-form__wide"><span>Description</span><textarea onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} rows={3} value={taskForm.description} /></label><div className="modal__actions"><Button disabled={isTaskSubmitting} type="submit">Save Task</Button><Button disabled={isTaskSubmitting} onClick={() => setIsTaskFormOpen(false)} type="button" variant="ghost">Cancel</Button></div>{taskError ? <p className="form-error">{taskError}</p> : null}</form></CardContent></Card> : null}

      <EditTransactionModal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} onSave={async (input) => { setDetailMessage(""); setDetailError(""); try { const message = await data.updateTransactionDetails(input); setDetailMessage(message || "Transaction details updated."); } catch (error) { setDetailError(error instanceof Error ? error.message : "Unable to update transaction."); throw error; } }} transaction={transaction} />

      {isTeamModalOpen ? <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="team-contact-title"><div className="modal__header"><div><h2 id="team-contact-title">Add Contact</h2><p>Connect an existing DoorScale contact to this transaction.</p></div><button aria-label="Close" onClick={() => setIsTeamModalOpen(false)} type="button">×</button></div><form className="task-create-form" onSubmit={handleAddTeamContact}><label className="task-create-form__wide"><span>Role</span><select onChange={(event) => setTeamRoleKey(event.target.value as TeamRoleKey)} value={teamRoleKey}>{TEAM_ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label><div className="transaction-team-search task-create-form__wide"><label><span>Search contacts</span><input onChange={(event) => setTeamSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void handleSearchTeamContacts(); } }} placeholder="Name, email, or phone" value={teamSearchQuery} /></label><Button disabled={isSearchingTeamContacts || teamSearchQuery.trim().length < 2} onClick={() => void handleSearchTeamContacts()} type="button" variant="secondary">{isSearchingTeamContacts ? "Searching..." : "Search"}</Button></div>{teamSearchResults.length ? <div className="transaction-team-results task-create-form__wide">{teamSearchResults.map((contact) => <button className={`team-contact-card ${selectedTeamContact?.id === contact.id ? "is-selected" : ""}`} key={contact.id} onClick={() => setSelectedTeamContact(contact)} type="button"><div><strong>{contact.name}</strong>{contact.email ? <small>{contact.email}</small> : null}{contact.phone ? <small>{contact.phone}</small> : null}</div></button>)}</div> : null}{selectedTeamContact ? <div className="association-linked-card task-create-form__wide"><h4>Selected Contact</h4><strong>{selectedTeamContact.name}</strong>{selectedTeamContact.email ? <small>{selectedTeamContact.email}</small> : null}{selectedTeamContact.phone ? <small>{selectedTeamContact.phone}</small> : null}</div> : null}{teamAssociationError ? <p className="form-error task-create-form__wide">{teamAssociationError}</p> : null}<div className="modal__actions task-create-form__wide"><Button disabled={isSavingTeamAssociation || !selectedTeamContact} type="submit">{isSavingTeamAssociation ? "Adding..." : "Add Contact"}</Button><Button disabled={isSavingTeamAssociation} onClick={() => setIsTeamModalOpen(false)} type="button" variant="ghost">Cancel</Button></div></form></div></div> : null}

      <section className="transaction-workspace-layout">
        <div className="transaction-workspace-layout__left">
          <Card><CardHeader><div><CardTitle>Key Dates</CardTitle><CardDescription>Inspection and closing timeline.</CardDescription></div></CardHeader><CardContent><dl className="detail-list"><div><dt>Inspection Date</dt><dd>{formatDate(fields.inspectionDeadline)}</dd></div><div><dt>Closing Date</dt><dd><CalendarClock size={15} />{formatDate(fields.closingDate)}</dd></div><div><dt>Days Until Closing</dt><dd>{getDaysUntilClosing(fields.closingDate)}</dd></div></dl></CardContent></Card>
          <Card><CardHeader><div><CardTitle>Transaction Team</CardTitle><CardDescription>Contacts associated with the CRM Transaction record.</CardDescription></div></CardHeader><CardContent><div className="transaction-team-list">{isLoadingAssociations ? <p className="empty-state">Loading transaction team...</p> : null}{associatedContactCount ? (Object.entries(associatedContactsByLabel) as Array<[string, TransactionAssociation[]]>).map(([label, contacts]) => <section className="association-group" key={label}><h4>{label}</h4>{contacts.map((contact) => <article className="team-contact-card" key={`${label}-${contact.relationId || contact.id || contact.name}`}><div><strong>{contact.name}</strong><span>{contact.role || label}</span>{contact.company ? <small>{contact.company}</small> : null}{contact.email ? <small>{contact.email}</small> : null}{contact.phone ? <small>{contact.phone}</small> : null}</div><div className="document-actions">{contact.openUrl ? <a className="button button--secondary" href={contact.openUrl} rel="noreferrer" target="_blank">Open Contact</a> : null}{contact.relationId ? <button className="button button--ghost" onClick={() => void handleRemoveTeamAssociation(contact)} type="button">Remove Association</button> : null}</div></article>)}</section>) : <div className="team-contact-card"><div><strong>{primaryContactName}</strong><span>{primaryContactRole}</span>{fields.contactEmail ? <small>{fields.contactEmail}</small> : null}{fields.contactPhone ? <small>{fields.contactPhone}</small> : null}</div>{contactLink ? <a className="button button--secondary" href={contactLink} rel="noreferrer" target="_blank">Open Contact</a> : null}</div>}{linkedOrganization ? <section className="association-linked-card"><h4>Linked Organization</h4><strong>{linkedOrganization.name}</strong>{linkedOrganization.email ? <small>{linkedOrganization.email}</small> : null}{linkedOrganization.phone ? <small>{linkedOrganization.phone}</small> : null}</section> : null}{linkedProperty ? <section className="association-linked-card"><h4>Property</h4><strong>{linkedProperty.name}</strong>{linkedProperty.company ? <small>{linkedProperty.company}</small> : null}</section> : null}</div><Button onClick={() => { setTeamAssociationError(""); setIsTeamModalOpen(true); }} type="button" variant="ghost">Add Contact</Button></CardContent></Card>
          <Card><CardHeader><div><CardTitle>Financial Summary</CardTitle><CardDescription>Projected transaction value.</CardDescription></div></CardHeader><CardContent><dl className="detail-list"><div><dt>Commission</dt><dd>{formatCurrency(transaction.value)}</dd></div><div><dt>Status</dt><dd>{transaction.status || "Not set"}</dd></div><div><dt>Assigned Agent</dt><dd>{fields.assignedAgent || "Not assigned"}</dd></div></dl></CardContent></Card>
          {propertyAddress !== "Property not set" ? <Card><CardHeader><div><CardTitle>Property Details</CardTitle><CardDescription>Transaction property information.</CardDescription></div></CardHeader><CardContent><dl className="detail-list"><div><dt>Address</dt><dd>{propertyAddress}</dd></div><div><dt>Transaction Type</dt><dd>{fields.transactionType || "Not set"}</dd></div></dl></CardContent></Card> : null}
        </div>
        <div className="transaction-workspace-layout__right"><Card className="workspace-panel-card"><CardHeader><div><CardTitle>Workspace</CardTitle><CardDescription>Tasks, documents, and notes for this transaction.</CardDescription></div></CardHeader><CardContent><div className="workspace-tabs" role="tablist" aria-label="Workspace sections"><button className={activeWorkspaceTab === "tasks" ? "is-active" : ""} onClick={() => setActiveWorkspaceTab("tasks")} type="button">Tasks / Checklist</button><button className={activeWorkspaceTab === "documents" ? "is-active" : ""} onClick={() => setActiveWorkspaceTab("documents")} type="button">Documents</button><button className={activeWorkspaceTab === "notes" ? "is-active" : ""} onClick={() => setActiveWorkspaceTab("notes")} type="button">Notes / Activity</button></div>
          {activeWorkspaceTab === "tasks" ? <section className="workspace-tab-panel">{relatedTasks.length ? <div className="task-list workspace-scroll-list workspace-scroll-list--tasks">{relatedTasks.map((task) => <TaskItem key={task.id} onComplete={data.markTaskCompleted} onRetrySync={data.retryTaskSync} onUpdateDueDateTime={data.updateTaskDueDateTime} task={task} />)}</div> : <div className="empty-state">No tasks connected to this transaction yet.</div>}</section> : null}
          {activeWorkspaceTab === "documents" ? <section className="workspace-tab-panel"><div className="placeholder-list workspace-scroll-list workspace-scroll-list--documents">{!documentTrackingRows.length ? <div className="empty-state"><p>{isPreparingDocuments ? "Preparing document checklist..." : "No document checklist templates found for this transaction yet."}</p>{!isPreparingDocuments ? <div className="manual-document-upload"><input aria-label="Document name" onChange={(event) => setManualDocumentName(event.target.value)} placeholder="Document name or type" value={manualDocumentName} /><label className="button button--secondary document-upload-label"><Upload size={15} />{uploadingDocumentId === "manual" ? "Uploading..." : "Upload Document"}<input disabled={uploadingDocumentId === "manual"} onChange={(event) => void handleManualDocumentFileSelected(event)} type="file" /></label></div> : null}</div> : null}{documentTrackingRows.map(({ document: documentRecord, documentType }) => { const inputId = `file-${documentRecord.id}`; const statusOptions = [["needed", "Required"], ["uploaded", "Uploaded"], ["missing", "Missing"]]; return <div className="placeholder-row" key={documentType}><FileText size={16} /><div>{renamingDocumentIds.includes(documentRecord.id) ? <input aria-label="Rename document" onChange={(event) => setRenameValues((currentValues) => ({ ...currentValues, [documentRecord.id]: event.target.value }))} value={renameValues[documentRecord.id] ?? (documentRecord.documentName || documentType)} /> : <span>{documentRecord.documentName || documentType}</span>}<small>{documentRecord.fileName || documentRecord.doorScaleFileId || "No file uploaded"}</small><small>{documentRecord.uploadedAt ? `Uploaded ${formatDate(documentRecord.uploadedAt)}` : "No upload date"}</small></div><Badge variant={documentStatusVariant(documentRecord.status || "Needed")}>{formatDocumentStatus(documentRecord.status)}</Badge><select aria-label={`Update ${documentType} status`} onChange={(event) => { void handleDocumentStatusChange(documentRecord, event.target.value); }} value={normalizeDocumentStatus(documentRecord.status)}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><div className="document-actions">{documentRecord.doorScaleFileId ? <a className="button button--ghost" href={buildDocumentViewLink(documentRecord.id, transactionId)} rel="noreferrer" target="_blank">View File</a> : null}<input aria-label={`Upload ${documentType}`} id={inputId} style={{ display: "none" }} onChange={(event) => { handleDocumentFileSelected(event, documentRecord); }} type="file" /><button className="button button--secondary" onClick={() => { window.document.getElementById(`file-${documentRecord.id}`)?.click(); }} type="button"><Upload size={15} />{uploadingDocumentId === documentRecord.id ? "Uploading..." : documentRecord.doorScaleFileId ? "Replace File" : "Upload Document"}</button>{renamingDocumentIds.includes(documentRecord.id) ? <><button className="button button--ghost" onClick={() => void handleRenameDocument(documentRecord)} type="button">Save Name</button><button className="button button--ghost" onClick={() => setRenamingDocumentIds((currentIds) => currentIds.filter((itemId) => itemId !== documentRecord.id))} type="button">Cancel</button></> : <button className="button button--ghost" onClick={() => { setRenameValues((currentValues) => ({ ...currentValues, [documentRecord.id]: documentRecord.documentName || documentType })); setRenamingDocumentIds((currentIds) => [...currentIds, documentRecord.id]); }} type="button">Rename</button>}</div></div>; })}</div></section> : null}
          {activeWorkspaceTab === "notes" ? <section className="workspace-tab-panel"><form className="notes-form" onSubmit={handleAddNote}><textarea onChange={(event) => setNoteText(event.target.value)} placeholder="Add a transaction note..." value={noteText} /><Button disabled={isSavingNote || !noteText.trim()} type="submit"><StickyNote size={16} />{isSavingNote ? "Saving..." : "Add Note"}</Button></form><div className="notes-list">{transactionNotes.map((note) => <article className="note-row" key={note.id}><div><Badge variant={note.source === "CRM" ? "default" : "muted"}>{note.source}</Badge><span>{formatDate(note.createdAt)}</span></div><p>{note.body}</p>{note.syncStatus !== "synced" ? <small>{note.lastSyncError || statusLabel(note.syncStatus)}</small> : null}</article>)}{isLoadingNotes ? <p className="empty-state">Loading notes...</p> : null}{!isLoadingNotes && !transactionNotes.length ? <div className="notes-placeholder"><StickyNote size={20} />No notes yet.</div> : null}</div></section> : null}
        </CardContent></Card></div>
      </section>
    </div>
  );
}





