/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { fetchPaperById } from "../services/paperApi";

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: "short"
  }).format(new Date(value));
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
