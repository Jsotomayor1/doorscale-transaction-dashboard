import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import Commissions from "@/pages/Commissions";
import Index from "@/pages/Index";
import Tasks from "@/pages/Tasks";
import Transactions from "@/pages/Transactions";
import "./App.css";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Index />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="commissions" element={<Commissions />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
