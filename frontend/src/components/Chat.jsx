/* eslint-disable react/prop-types */
import { useCallback, useEffect, useRef, useState } from "react";
import { askPaperQuestion, fetchChatHistory } from "../services/chatApi";
import { friendlyError } from "../services/errorUtil";
import { fetchPapers } from "../services/paperApi";

const SUGGESTED_QUESTIONS = [
  "Summarize this paper",
  "What methodology was used?",
  "What are the key findings?",
  "What are the limitations?",
  "What future work is suggested?"
];

function isCanceledRequest(error) {
  return error?.code === "ERR_CANCELED" || error?.name === "CanceledError";
}

function formatTime(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function Spinner({ label }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-lg rounded-bl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]" />
          <span className="ml-1">Reading paper...</span>
        </div>
      </div>
    </div>
  );
}

function SourceList({ sources }) {
  if (!sources?.length) {
    return null;
  }

  return (
    <div className="mt-3 grid gap-2 border-t border-slate-200 pt-3">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
        Sources
      </p>
      {sources.map((source, index) => (
        <div
          className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600"
          key={`${source.chunkId}-${index}`}
        >
          <p className="font-bold text-slate-800">
            Chunk {source.chunkId}
            {source.page ? ` | Page ${source.page}` : ""}
          </p>
          <p className="mt-1">{source.snippet}</p>
        </div>
      ))}
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <article
        className={`max-w-[85%] rounded-lg px-4 py-3 text-sm leading-6 shadow-sm ${
          isUser
            ? "rounded-br-sm bg-indigo-600 text-white"
            : "rounded-bl-sm border border-slate-200 bg-white text-slate-700"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <p
          className={`mt-2 text-right text-xs ${
            isUser ? "text-indigo-100" : "text-slate-400"
          }`}
        >
          {formatTime(message.timestamp)}
        </p>
        {!isUser && <SourceList sources={message.sources} />}
      </article>
    </div>
  );
}

function AlertCard({ message, onRetry }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-semibold">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="w-fit rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

function ChatPicker({ onOpenChat }) {
  const [papers, setPapers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadPapers() {
      try {
        setIsLoading(true);
        setError("");
        const result = await fetchPapers({
          page: 1,
          limit: 50,
          signal: controller.signal
        });
        setPapers(result.papers);
      } catch (apiError) {
        if (!isCanceledRequest(apiError)) {
          setError("Unable to load papers for chat. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadPapers();

    return () => controller.abort();
  }, []);

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
          Chat
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
          Choose a paper to chat with
        </h1>
      </header>

      {isLoading && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-600 shadow-sm">
          <Spinner label="Loading papers..." />
        </div>
      )}

      {!isLoading && error && <AlertCard message={error} />}

      {!isLoading && !error && papers.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Upload a paper before starting a chat.
        </div>
      )}

      {!isLoading && !error && papers.length > 0 && (
        <div className="grid gap-3">
          {papers.map((paper) => (
            <article
              className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              key={paper._id}
            >
              <div>
                <h2 className="break-words text-base font-bold text-slate-950">
                  {paper.title}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {paper.originalFilename}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenChat(paper._id)}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                Open Chat
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Chat({ onActivityChange, paperId, onBack, onOpenChat }) {
  const [paper, setPaper] = useState(null);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(paperId));
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  const loadHistory = useCallback(async () => {
    if (!paperId) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setIsLoading(true);
      setError("");
      const result = await fetchChatHistory(paperId, {
        signal: controller.signal
      });
      setPaper(result.paper);
      setMessages(result.messages || []);
    } catch (apiError) {
      if (!isCanceledRequest(apiError)) {
        setError(
          friendlyError(apiError, "Unable to load this paper chat. Please try again.")
        );
      }
    } finally {
      if (abortRef.current === controller) {
        setIsLoading(false);
        abortRef.current = null;
      }
    }
  }, [paperId]);

  useEffect(() => {
    loadHistory();

    return () => abortRef.current?.abort();
  }, [loadHistory]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending]);

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  const sendQuestion = async (nextQuestion = question) => {
    const trimmedQuestion = nextQuestion.trim();

    if (!trimmedQuestion || isSending) {
      if (!trimmedQuestion) {
        setSendError("Please enter a question before sending.");
      }
      return;
    }

    const optimisticMessage = {
      role: "user",
      content: trimmedQuestion,
      timestamp: new Date().toISOString()
    };

    setMessages((currentMessages) => [...currentMessages, optimisticMessage]);
    setQuestion("");
    setSendError("");
    setIsSending(true);

    try {
      const result = await askPaperQuestion(paperId, trimmedQuestion);
      const assistantMessage = {
        role: "assistant",
        content: result.answer,
        sources: result.sources || [],
        timestamp: new Date().toISOString()
      };

      setMessages((currentMessages) => [...currentMessages, assistantMessage]);
      onActivityChange?.();
    } catch (apiError) {
      setMessages((currentMessages) => currentMessages.slice(0, -1));
      setQuestion(trimmedQuestion);
      setSendError(friendlyError(apiError, "The AI could not answer right now. Please try again."));
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendQuestion();
  };

  if (!paperId) {
    return <ChatPicker onOpenChat={onOpenChat} />;
  }

  return (
    <section className="mx-auto grid h-[calc(100vh-73px)] w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)] gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
              Chat with your paper
            </p>
            <h1 className="mt-2 break-words text-2xl font-bold tracking-normal text-slate-950">
              {paper?.title || "Paper chat"}
            </h1>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="w-fit rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-indigo-500 hover:text-indigo-700"
          >
            Back to dashboard
          </button>
        </div>
      </header>

      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex gap-2 overflow-x-auto border-b border-slate-200 p-3">
          {SUGGESTED_QUESTIONS.map((suggestion) => (
            <button
              type="button"
              key={suggestion}
              onClick={() => sendQuestion(suggestion)}
              disabled={isLoading || isSending}
              className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-indigo-400 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <div className="min-h-0 overflow-y-auto bg-slate-50 p-4">
          {isLoading && (
            <div className="grid h-full place-items-center text-sm font-semibold text-slate-600">
              <Spinner label="Loading chat..." />
            </div>
          )}

          {!isLoading && error && (
            <AlertCard message={error} onRetry={loadHistory} />
          )}

          {!isLoading && !error && (
            <div className="grid gap-4">
              {messages.length === 0 && (
                <div className="mx-auto max-w-lg rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm leading-6 text-slate-500">
                  Ask a question about the paper or use a suggested prompt to
                  start.
                </div>
              )}
              {messages.map((message, index) => (
                <MessageBubble message={message} key={`${message.timestamp}-${index}`} />
              ))}
              {isSending && <TypingIndicator />}
              <div ref={scrollRef} />
            </div>
          )}
        </div>

        <form
          className="grid gap-2 border-t border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
          onSubmit={handleSubmit}
        >
          <div>
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value);
                setSendError("");
              }}
              disabled={isLoading || isSending || Boolean(error)}
              placeholder="Ask about methodology, findings, limitations..."
              className="min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
            {sendError && (
              <p className="mt-2 text-sm font-semibold text-red-700">
                {sendError}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={isLoading || isSending || Boolean(error)}
            className="min-h-11 rounded-md bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSending ? <Spinner label="Sending..." /> : "Send"}
          </button>
        </form>
      </div>
    </section>
  );
}

export default Chat;
