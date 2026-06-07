import { useState } from "react";
import axios from "axios";

const API_BASE_URL = "";

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

function PDFUpload() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [status, setStatus] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [summary, setSummary] = useState(emptySummary);
  const [summaryStatus, setSummaryStatus] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [analysis, setAnalysis] = useState(emptyAnalysis);
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isAnalyzingPaper, setIsAnalyzingPaper] = useState(false);

  const onFileChange = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file || null);
    setStatus("");
    setExtractedText("");
    setSummary(emptySummary);
    setSummaryStatus("");
    setSummaryError("");
    setAnalysis(emptyAnalysis);
    setAnalysisStatus("");
    setAnalysisError("");
  };

  const onUpload = async () => {
    if (!selectedFile) {
      setStatus("Please select a PDF file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      setIsUploading(true);
      setStatus("Uploading and extracting text...");
      setSummary(emptySummary);
      setSummaryStatus("");
      setSummaryError("");
      setAnalysis(emptyAnalysis);
      setAnalysisStatus("");
      setAnalysisError("");
      const response = await axios.post(
        `${API_BASE_URL}/api/papers/upload`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data"
          }
        }
      );

      setStatus(`Uploaded: ${response.data.filename}`);
      setExtractedText(response.data.text || "");
      setSelectedFile(null);
    } catch (error) {
      const message =
        error.response?.data?.error ||
        error.message ||
        "Upload failed.";
      setStatus(message);
      setExtractedText("");
    } finally {
      setIsUploading(false);
    }
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

      const response = await axios.post(
        `${API_BASE_URL}/api/papers/summary`,
        {
          text: extractedText
        }
      );

      setSummary(response.data.summary || emptySummary);
      setSummaryStatus("Summary generated successfully.");
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

      const response = await axios.post(
        `${API_BASE_URL}/api/papers/analyze`,
        {
          paperText: extractedText
        }
      );

      setAnalysis({
        concepts: response.data.concepts || [],
        prerequisites: response.data.prerequisites || [],
        domain: response.data.domain || "",
        subdomain: response.data.subdomain || "",
        difficulty: response.data.difficulty || "",
        estimatedReadingTime: response.data.estimatedReadingTime || "",
        learningPath: response.data.learningPath || []
      });
      setAnalysisStatus("Paper analysis generated successfully.");
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

  return (
    <section className="paper-page">
      <header className="hero-card">
        <p className="eyebrow">Task 6</p>
        <h1>AI-Powered Paper Summarization</h1>
        <p className="hero-copy">
          Upload a PDF, extract its text, and generate a structured Gemini summary.
        </p>
      </header>

      <div className="workspace-grid">
        <section className="panel upload-panel">
          <h2>Upload Paper</h2>
          <label className="file-drop">
            <input
              type="file"
              accept="application/pdf"
              onChange={onFileChange}
            />
            <span>
              {selectedFile ? selectedFile.name : "Choose a PDF to begin"}
            </span>
          </label>

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
          </div>

          {status && <p className="status">{status}</p>}
          {summaryStatus && <p className="status">{summaryStatus}</p>}
          {summaryError && <p className="error">{summaryError}</p>}
          {analysisStatus && <p className="status">{analysisStatus}</p>}
          {analysisError && <p className="error">{analysisError}</p>}
        </section>

        <section className="panel">
          <h2>Extracted Text</h2>
          {extractedText ? (
            <pre className="text-block">{extractedText}</pre>
          ) : (
            <p className="placeholder">
              Upload a PDF to preview the extracted paper text here.
            </p>
          )}
        </section>
      </div>

      {summary.shortSummary && (
        <section className="panel summary-panel">
          <h2>Generated Summary</h2>

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

      {analysis.concepts.length > 0 || analysis.prerequisites.length > 0 ? (
        <section className="panel summary-panel">
          <h2>Paper Intelligence</h2>

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
        </section>
      ) : (
        <section className="panel summary-panel">
          <h2>Paper Intelligence</h2>
          <p className="placeholder">
            Click Analyze Paper after extracting text to see concepts, prerequisites,
            domain, difficulty, and a learning path.
          </p>
        </section>
      )}
    </section>
  );
}

export default PDFUpload;
