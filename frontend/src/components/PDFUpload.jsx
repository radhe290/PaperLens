/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const emptySummary = {
  shortSummary: "",
  keyContributions: [],
  beginnerFriendlyExplanation: ""
};

const emptyAnalysis = {
  concepts: [],
  prerequisites: [],
  domain: "",
  subdomain: "",
  difficulty: "",
  estimatedReadingTime: "",
  learningPath: []
};

const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
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

function PDFUpload({ onActivityChange }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadedPaper, setUploadedPaper] = useState({
    title: "",
    originalFilename: "",
    storedFilename: "",
    cloudinaryPublicId: "",
    fileUrl: "",
    fileSize: 0,
    pageCount: 0,
    wordCount: 0
  });
  const [currentPaperId, setCurrentPaperId] = useState("");
  const [savedPapers, setSavedPapers] = useState([]);
  const [dashboardStatus, setDashboardStatus] = useState("");
  const [status, setStatus] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [summary, setSummary] = useState(emptySummary);
  const [summaryStatus, setSummaryStatus] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [analysis, setAnalysis] = useState(emptyAnalysis);
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingPaper, setIsSavingPaper] = useState(false);
  const [isLoadingPapers, setIsLoadingPapers] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isAnalyzingPaper, setIsAnalyzingPaper] = useState(false);

  const fetchSavedPapers = async () => {
    try {
      setIsLoadingPapers(true);
      const response = await axios.get(`${API_BASE_URL}/api/papers`);
      setSavedPapers(response.data.papers || []);
      setDashboardStatus("");
    } catch (error) {
      const message =
        error.response?.data?.error ||
        error.message ||
        "Failed to load saved papers.";
      setDashboardStatus(message);
    } finally {
      setIsLoadingPapers(false);
    }
  };

  useEffect(() => {
    fetchSavedPapers();
  }, []);

  const resetGeneratedState = () => {
    setSummary(emptySummary);
    setSummaryStatus("");
    setSummaryError("");
    setAnalysis(emptyAnalysis);
    setAnalysisStatus("");
    setAnalysisError("");
  };

  const onFileChange = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file || null);
    setStatus("");
    setExtractedText("");
    setUploadedPaper({
      title: file?.name?.replace(/\.pdf$/i, "") || "",
      originalFilename: file?.name || "",
      storedFilename: "",
      cloudinaryPublicId: "",
      fileUrl: "",
      fileSize: file?.size || 0,
      pageCount: 0,
      wordCount: 0
    });
    setCurrentPaperId("");
    resetGeneratedState();
  };

  const onUpload = async () => {
    if (!selectedFile) {
      setStatus("Please select a PDF file.");
      return;
    }

    if (selectedFile.type !== "application/pdf") {
      setStatus("Only PDF files can be uploaded.");
      return;
    }

    if (selectedFile.size > MAX_PDF_SIZE_BYTES) {
      setStatus("PDF files must be 20MB or smaller.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      setIsUploading(true);
      setStatus("Uploading and extracting text...");
      resetGeneratedState();

      const response = await axios.post(
        `${API_BASE_URL}/api/papers`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data"
          }
        }
      );

      setStatus(`Uploaded to cloud storage: ${response.data.originalFilename}`);
      setExtractedText(response.data.text || "");
      setUploadedPaper({
        title: selectedFile.name.replace(/\.pdf$/i, ""),
        originalFilename: response.data.originalFilename || selectedFile.name,
        storedFilename: response.data.storedFilename || response.data.filename || "",
        cloudinaryPublicId: response.data.cloudinaryPublicId || "",
        fileUrl: response.data.fileUrl || response.data.secureUrl || "",
        fileSize: response.data.fileSize || selectedFile.size || 0,
        pageCount: response.data.pageCount || 0,
        wordCount: response.data.wordCount || 0
      });
      setSelectedFile(null);
      setCurrentPaperId("");
      onActivityChange?.();
    } catch (error) {
      const message =
        error.response?.data?.error || error.message || "Upload failed.";
      setStatus(message);
      setExtractedText("");
    } finally {
      setIsUploading(false);
    }
  };

  const persistPaperUpdate = async (nextSummary, nextAnalysis) => {
    if (!currentPaperId) {
      return;
    }

    await axios.put(`${API_BASE_URL}/api/papers/${currentPaperId}`, {
      summary: nextSummary,
      analysis: nextAnalysis
    });

    await fetchSavedPapers();
  };

  const onGenerateSummary = async () => {
    if (!extractedText) {
      setSummaryError("Upload and extract a paper before generating a summary.");
      return;
    }

    try {
      setIsGeneratingSummary(true);
      setSummaryError("");
      setSummaryStatus("Generating summary with Gemini...");

      const response = await axios.post(`${API_BASE_URL}/api/papers/summary`, {
        text: extractedText,
        title: uploadedPaper.title || uploadedPaper.originalFilename
      });

      const nextSummary = response.data.summary || emptySummary;
      setSummary(nextSummary);
      await persistPaperUpdate(nextSummary, analysis);
      setSummaryStatus(
        currentPaperId
          ? "Summary generated and saved successfully."
          : "Summary generated successfully."
      );
      onActivityChange?.();
    } catch (error) {
      const message =
        error.response?.data?.error ||
        error.message ||
        "Failed to generate summary.";
      setSummary(emptySummary);
      setSummaryStatus("");
      setSummaryError(message);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const onAnalyzePaper = async () => {
    if (!extractedText) {
      setAnalysisError("Upload and extract a paper before analyzing it.");
      return;
    }

    try {
      setIsAnalyzingPaper(true);
      setAnalysisError("");
      setAnalysisStatus("Analyzing paper structure with Gemini...");

      const response = await axios.post(`${API_BASE_URL}/api/papers/analyze`, {
        paperText: extractedText,
        title: uploadedPaper.title || uploadedPaper.originalFilename
      });

      const nextAnalysis = {
        concepts: response.data.concepts || [],
        prerequisites: response.data.prerequisites || [],
        domain: response.data.domain || "",
        subdomain: response.data.subdomain || "",
        difficulty: response.data.difficulty || "",
        estimatedReadingTime: response.data.estimatedReadingTime || "",
        learningPath: response.data.learningPath || []
      };

      setAnalysis(nextAnalysis);
      await persistPaperUpdate(summary, nextAnalysis);
      setAnalysisStatus(
        currentPaperId
          ? "Paper analysis generated and saved successfully."
          : "Paper analysis generated successfully."
      );
      onActivityChange?.();
    } catch (error) {
      const message =
        error.response?.data?.error ||
        error.message ||
        "Failed to analyze paper.";
      setAnalysis(emptyAnalysis);
      setAnalysisStatus("");
      setAnalysisError(message);
    } finally {
      setIsAnalyzingPaper(false);
    }
  };

  const onSavePaper = async () => {
    if (!extractedText) {
      setStatus("Upload and extract a paper before saving.");
      return;
    }

    try {
      setIsSavingPaper(true);
      setStatus("Saving paper to MongoDB...");

      const response = await axios.post(`${API_BASE_URL}/api/papers`, {
        title: uploadedPaper.title || uploadedPaper.originalFilename || "Untitled Paper",
        originalFilename: uploadedPaper.originalFilename,
        storedFilename: uploadedPaper.storedFilename,
        cloudinaryPublicId: uploadedPaper.cloudinaryPublicId,
        fileUrl: uploadedPaper.fileUrl,
        fileSize: uploadedPaper.fileSize,
        extractedText,
        pageCount: uploadedPaper.pageCount,
        wordCount: uploadedPaper.wordCount,
        summary,
        analysis
      });

      setCurrentPaperId(response.data.paper._id);
      setStatus("Paper saved.");
      await fetchSavedPapers();
    } catch (error) {
      const message =
        error.response?.data?.error ||
        error.message ||
        "Failed to save paper.";
      setStatus(message);
    } finally {
      setIsSavingPaper(false);
    }
  };

  const onSelectSavedPaper = async (paperId) => {
    try {
      setDashboardStatus("Loading paper details...");
      const response = await axios.get(`${API_BASE_URL}/api/papers/${paperId}`);
      const paper = response.data.paper;

      setCurrentPaperId(paper._id);
      setUploadedPaper({
        title: paper.title,
        originalFilename: paper.originalFilename,
        storedFilename: paper.storedFilename,
        cloudinaryPublicId: paper.cloudinaryPublicId || "",
        fileUrl: paper.fileUrl || "",
        fileSize: paper.fileSize || 0,
        pageCount: paper.pageCount || 0,
        wordCount: paper.wordCount || 0
      });
      setExtractedText(paper.extractedText || "");
      setSummary(paper.summary || emptySummary);
      setAnalysis(paper.analysis || emptyAnalysis);
      setStatus(`Loaded saved paper: ${paper.title}`);
      setDashboardStatus("");
      setSummaryStatus("");
      setSummaryError("");
      setAnalysisStatus("");
      setAnalysisError("");
    } catch (error) {
      const message =
        error.response?.data?.error ||
        error.message ||
        "Failed to load paper details.";
      setDashboardStatus(message);
    }
  };

  const onDeletePaper = async (paperId) => {
    try {
      setDashboardStatus("Deleting paper...");
      await axios.delete(`${API_BASE_URL}/api/papers/${paperId}`);

      if (paperId === currentPaperId) {
        setCurrentPaperId("");
        setUploadedPaper({
          title: "",
          originalFilename: "",
          storedFilename: "",
          cloudinaryPublicId: "",
          fileUrl: "",
          fileSize: 0,
          pageCount: 0,
          wordCount: 0
        });
        setExtractedText("");
        resetGeneratedState();
        setStatus("Deleted selected paper.");
      }

      await fetchSavedPapers();
      onActivityChange?.();
      setDashboardStatus("");
    } catch (error) {
      const message =
        error.response?.data?.error || error.message || "Failed to delete paper.";
      setDashboardStatus(message);
    }
  };

  return (
    <section className="paper-page">
      <header className="hero-card">
        <p className="eyebrow">Task 8</p>
        <h1>Persistent Paper Library</h1>
        <p className="hero-copy">
          Upload a PDF, extract its text, generate summary and analysis results,
          then save the complete paper record in MongoDB.
        </p>
      </header>

      <div className="workspace-grid">
        <section className="panel upload-panel">
          <h2>Upload Paper</h2>
          <label className="file-drop">
            <input type="file" accept="application/pdf" onChange={onFileChange} />
            <span>{selectedFile ? selectedFile.name : "Choose a PDF to begin"}</span>
          </label>

          {uploadedPaper.title && (
            <label className="field-label">
              Paper title
              <input
                type="text"
                value={uploadedPaper.title}
                onChange={(event) =>
                  setUploadedPaper((paper) => ({
                    ...paper,
                    title: event.target.value
                  }))
                }
              />
            </label>
          )}

          <div className="action-row">
            <button type="button" onClick={onUpload} disabled={isUploading}>
              {isUploading ? "Uploading..." : "Upload PDF"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={onGenerateSummary}
              disabled={!extractedText || isUploading || isGeneratingSummary}
            >
              {isGeneratingSummary ? "Generating..." : "Generate Summary"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={onAnalyzePaper}
              disabled={!extractedText || isUploading || isAnalyzingPaper}
            >
              {isAnalyzingPaper ? "Analyzing..." : "Analyze Paper"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={onSavePaper}
              disabled={!extractedText || isSavingPaper || Boolean(currentPaperId)}
            >
              {isSavingPaper ? "Saving..." : currentPaperId ? "Saved" : "Save Paper"}
            </button>
          </div>

          {uploadedPaper.originalFilename && (
            <div className="mt-4 grid gap-2 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
              <p>
                <strong className="text-slate-800">PDF size:</strong>{" "}
                {formatFileSize(uploadedPaper.fileSize)}
              </p>
              {uploadedPaper.fileUrl && (
                <div className="flex flex-wrap gap-2">
                  <a
                    href={uploadedPaper.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition hover:border-indigo-500 hover:text-indigo-700"
                  >
                    View PDF
                  </a>
                  <a
                    href={getDownloadUrl(uploadedPaper.fileUrl)}
                    target="_blank"
                    rel="noreferrer"
                    download={uploadedPaper.originalFilename}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition hover:border-indigo-500 hover:text-indigo-700"
                  >
                    Download PDF
                  </a>
                </div>
              )}
            </div>
          )}

          {status && <p className="status">{status}</p>}
          {summaryStatus && <p className="status">{summaryStatus}</p>}
          {summaryError && <p className="error">{summaryError}</p>}
          {analysisStatus && <p className="status">{analysisStatus}</p>}
          {analysisError && <p className="error">{analysisError}</p>}
        </section>

        <section className="panel dashboard-panel">
          <div className="section-heading">
            <h2>Saved Papers</h2>
            <button
              type="button"
              className="secondary compact"
              onClick={fetchSavedPapers}
              disabled={isLoadingPapers}
            >
              {isLoadingPapers ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {dashboardStatus && <p className="status">{dashboardStatus}</p>}

          {savedPapers.length > 0 ? (
            <div className="paper-list">
              {savedPapers.map((paper) => (
                <article
                  key={paper._id}
                  className={`paper-row-card ${paper._id === currentPaperId ? "active" : ""}`}
                >
                  <div className="paper-row-grid">
                    <div className="paper-left min-w-0">
                      <h3 className="paper-title truncate">{paper.title || paper.originalFilename}</h3>
                      <div className="mt-1 text-sm text-slate-500">
                        {formatDate(paper.uploadDate)} • {formatFileSize(paper.fileSize)}
                      </div>
                    </div>

                    <div className="paper-right text-sm text-slate-400">
                      <div className="truncate">
                        <strong className="font-medium text-slate-300">Domain:</strong> {paper.analysis?.domain || "—"}
                      </div>
                      <div className="mt-1 truncate">
                        <strong className="font-medium text-slate-300">Difficulty:</strong> {paper.analysis?.difficulty || "—"}
                      </div>
                      <div className="mt-1">
                        <strong className="font-medium text-slate-300">Pages:</strong> {paper.pageCount || "—"}
                      </div>
                    </div>
                  </div>

                  <div className="paper-actions mt-3 flex flex-wrap gap-2">
                    {paper.fileUrl && (
                      <a
                        href={paper.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-medium text-slate-100 transition hover:border-slate-500"
                      >
                        View PDF
                      </a>
                    )}

                    {paper.fileUrl && (
                      <a
                        href={getDownloadUrl(paper.fileUrl)}
                        target="_blank"
                        rel="noreferrer"
                        download={paper.originalFilename}
                        className="rounded-md border border-slate-700 bg-transparent px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-slate-500"
                      >
                        Download
                      </a>
                    )}

                    <a
                      href={`${API_BASE_URL}/api/papers/${paper._id}/export?format=pdf`}
                      className="rounded-md border border-slate-700 bg-transparent px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-slate-500"
                    >
                      Export PDF
                    </a>

                    <button
                      type="button"
                      className="rounded-md border border-rose-700 bg-rose-900/5 px-3 py-2 text-xs font-medium text-rose-400"
                      onClick={() => onDeletePaper(paper._id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="placeholder">Saved papers will appear here.</p>
          )}
        </section>
      </div>

      <section className="panel">
        <h2>Extracted Text</h2>
        {extractedText ? (
          <pre className="text-block">{extractedText}</pre>
        ) : (
          <p className="placeholder">
            Upload a PDF or open a saved paper to preview extracted text.
          </p>
        )}
      </section>

      {summary.shortSummary && (
        <section className="panel summary-panel">
          <h2>Summary</h2>

          <div className="summary-grid">
            <article className="summary-card">
              <h3>Short Summary</h3>
              <p>{summary.shortSummary}</p>
            </article>

            <article className="summary-card">
              <h3>Key Contributions</h3>
              <ul>
                {summary.keyContributions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="summary-card full-width">
              <h3>Beginner-Friendly Explanation</h3>
              <p>{summary.beginnerFriendlyExplanation}</p>
            </article>
          </div>
        </section>
      )}

      <section className="panel summary-panel">
        <h2>Paper Details</h2>

        {analysis.concepts.length > 0 || analysis.prerequisites.length > 0 ? (
          <div className="summary-grid">
            <article className="summary-card">
              <h3>Domain</h3>
              <p>{analysis.domain || "Not available"}</p>
              <p>{analysis.subdomain || ""}</p>
            </article>

            <article className="summary-card">
              <h3>Difficulty</h3>
              <p>{analysis.difficulty || "Not available"}</p>
              <p>{analysis.estimatedReadingTime || ""}</p>
            </article>

            <article className="summary-card">
              <h3>Concepts</h3>
              {analysis.concepts.length > 0 ? (
                <ul>
                  {analysis.concepts.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="placeholder">No concepts generated yet.</p>
              )}
            </article>

            <article className="summary-card">
              <h3>Prerequisites</h3>
              {analysis.prerequisites.length > 0 ? (
                <ul>
                  {analysis.prerequisites.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="placeholder">No prerequisites generated yet.</p>
              )}
            </article>

            <article className="summary-card full-width">
              <h3>Learning Path</h3>
              {analysis.learningPath.length > 0 ? (
                <ol>
                  {analysis.learningPath.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              ) : (
                <p className="placeholder">No learning path generated yet.</p>
              )}
            </article>
          </div>
        ) : (
          <p className="placeholder">
            Analyze an uploaded paper or open a saved paper to see concepts,
            prerequisites, domain, difficulty, and a learning path.
          </p>
        )}
      </section>
    </section>
  );
}

export default PDFUpload;
