import { Navigate, Route, Routes } from "react-router-dom";
import { DoorScaleGate } from "@/components/DoorScaleGate";
import { Layout } from "@/components/Layout";
import ChooseAccount from "@/pages/ChooseAccount";
import Commissions from "@/pages/Commissions";
import Index from "@/pages/Index";
import MobileDashboard from "@/pages/MobileDashboard";
import PrivateIntegration from "@/pages/PrivateIntegration";
import Tasks from "@/pages/Tasks";
import TransactionDetail from "@/pages/TransactionDetail";
import Transactions from "@/pages/Transactions";
import "./App.css";

export default function App() {
  return (
    <Routes>
      <Route path="mobile" element={<MobileDashboard />} />
      <Route element={<Layout />}>
        <Route element={<DoorScaleGate />}>
          <Route index element={<Index />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="transactions/:id" element={<TransactionDetail />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="commissions" element={<Commissions />} />
        </Route>
        <Route path="choose-account" element={<ChooseAccount />} />
        <Route path="private-integration" element={<PrivateIntegration />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
