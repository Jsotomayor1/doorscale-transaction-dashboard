import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import Index from "@/pages/Index";
import "./App.css";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Index />} />
        <Route path="transactions" element={<Index />} />
        <Route path="tasks" element={<Index />} />
        <Route path="commissions" element={<Index />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
