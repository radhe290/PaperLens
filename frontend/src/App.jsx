import { useState } from "react";
import "./App.css";
import Dashboard from "./components/Dashboard";
import PaperDetail from "./components/PaperDetail";
import PDFUpload from "./components/PDFUpload";

function App() {
  const [view, setView] = useState("dashboard");
  const [selectedPaperId, setSelectedPaperId] = useState("");

  const openDashboard = () => {
    setSelectedPaperId("");
    setView("dashboard");
  };

  const openUpload = () => {
    setSelectedPaperId("");
    setView("upload");
  };

  const openPaperDetail = (paperId) => {
    setSelectedPaperId(paperId);
    setView("detail");
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <button
            type="button"
            className="text-left text-xl font-bold text-slate-950"
            onClick={openDashboard}
          >
            PaperLens
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={openDashboard}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                view === "dashboard" || view === "detail"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={openUpload}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                view === "upload"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Upload
            </button>
          </div>
        </div>
      </nav>

      {view === "dashboard" && <Dashboard onViewPaper={openPaperDetail} />}
      {view === "detail" && (
        <PaperDetail paperId={selectedPaperId} onBack={openDashboard} />
      )}
      {view === "upload" && (
        <div className="app-shell">
          <PDFUpload />
        </div>
      )}
    </main>
  );
}

export default App;
