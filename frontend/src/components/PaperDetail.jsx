/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { fetchPaperById, exportPaper } from "../services/paperApi";
import { friendlyError } from "../services/errorUtil";

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatFileSize(bytes) {
  if (!bytes) {
    return "Not available";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getDownloadUrl(fileUrl) {
  if (!fileUrl) {
    return "";
  }

  if (fileUrl.includes("/upload/") && fileUrl.includes("cloudinary.com")) {
    return fileUrl.replace("/upload/", "/upload/fl_attachment/");
  }

  return fileUrl;
}

function ListBlock({ items, ordered = false }) {
  if (!items?.length) {
    return <p className="text-sm text-slate-500">No saved items.</p>;
  }

  const ListTag = ordered ? "ol" : "ul";

  return (
    <ListTag className="space-y-2 pl-5 text-sm leading-6 text-slate-700">
      {items.map((item) => (
        <li className={ordered ? "list-decimal" : "list-disc"} key={item}>
          {item}
        </li>
      ))}
    </ListTag>
  );
}

function PaperDetail({ paperId, onBack }) {
  const [paper, setPaper] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState("");

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = async (format) => {
    if (!paper) {
      return;
    }

    setIsExporting(true);
    setExportFormat(format);

    try {
      const response = await exportPaper(paperId, format);
      const filename = response.headers["content-disposition"]
        ?.match(/filename="?([^";]+)"?/)?.[1] ||
        `${paper.title || "paperlens-export"}.${format}`;
      downloadBlob(response.data, filename);
    } catch (apiError) {
        setError(friendlyError(apiError, "Export failed."));
    } finally {
      setIsExporting(false);
      setExportFormat("");
    }
  };

  useEffect(() => {
    async function loadPaper() {
      try {
        setIsLoading(true);
        setError("");
        const savedPaper = await fetchPaperById(paperId);
        setPaper(savedPaper);
      } catch (apiError) {
        setError(
          apiError.response?.data?.error ||
            apiError.message ||
            "Failed to load paper details."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadPaper();
  }, [paperId]);

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onBack}
        className="w-fit rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-indigo-500 hover:text-indigo-700"
      >
        Back to dashboard
      </button>

      {isLoading && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
          Loading paper details...
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {!isLoading && paper && (
        <>
          <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
              Uploaded {formatDate(paper.uploadDate)}
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-normal text-slate-950">
              {paper.title}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Original file: {paper.originalFilename}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              PDF size: {formatFileSize(paper.fileSize)}
            </p>
            {paper.fileUrl && (
              <>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href={paper.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  >
                    View PDF
                  </a>
                  <a
                    href={getDownloadUrl(paper.fileUrl)}
                    target="_blank"
                    rel="noreferrer"
                    download={paper.originalFilename}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-indigo-500 hover:text-indigo-700"
                  >
                    Download PDF
                  </a>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleExport("pdf")}
                    disabled={isExporting}
                    className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isExporting && exportFormat === "pdf" ? "Exporting PDF..." : "Export PDF"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport("markdown")}
                    disabled={isExporting}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-indigo-500 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isExporting && exportFormat === "markdown" ? "Exporting MD..." : "Export MD"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport("text")}
                    disabled={isExporting}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-indigo-500 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isExporting && exportFormat === "text" ? "Exporting TXT..." : "Export TXT"}
                  </button>
                </div>
              </>
            )}
          </header>

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h2 className="text-lg font-bold text-slate-950">Full Summary</h2>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                {paper.summary?.shortSummary || "No summary saved."}
              </p>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">
                Key Contributions
              </h2>
              <div className="mt-3">
                <ListBlock items={paper.summary?.keyContributions} />
              </div>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">
                Beginner-Friendly Explanation
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                {paper.summary?.beginnerFriendlyExplanation ||
                  "No explanation saved."}
              </p>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">Analysis</h2>
              <dl className="mt-3 grid gap-3 text-sm">
                <div>
                  <dt className="font-semibold text-slate-900">Domain</dt>
                  <dd className="text-slate-600">
                    {paper.analysis?.domain || "Not available"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-900">Subdomain</dt>
                  <dd className="text-slate-600">
                    {paper.analysis?.subdomain || "Not available"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-900">Difficulty</dt>
                  <dd className="text-slate-600">
                    {paper.analysis?.difficulty || "Not available"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-900">
                    Estimated Reading Time
                  </dt>
                  <dd className="text-slate-600">
                    {paper.analysis?.estimatedReadingTime || "Not available"}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">Concepts</h2>
              <div className="mt-3">
                <ListBlock items={paper.analysis?.concepts} />
              </div>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">Prerequisites</h2>
              <div className="mt-3">
                <ListBlock items={paper.analysis?.prerequisites} />
              </div>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">Learning Path</h2>
              <div className="mt-3">
                <ListBlock items={paper.analysis?.learningPath} ordered />
              </div>
            </article>
          </div>
        </>
      )}
    </section>
  );
}

export default PaperDetail;
