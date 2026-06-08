/* eslint-disable react/prop-types */
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { friendlyError } from "../services/errorUtil";

function Login({ onAuthenticated, onShowSignup, onToast }) {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field, value) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
    setError("");
  };

  const onSubmit = async (event) => {
    event.preventDefault();

    if (!form.email.trim() || !form.password) {
      setError("Email and password are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      await login({
        email: form.email.trim(),
        password: form.password
      });
      onToast("Login successful.");
      onAuthenticated();
    } catch (apiError) {
          const message = friendlyError(apiError, "Invalid credentials.");
      setError(message);
      onToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto grid min-h-[calc(100vh-73px)] w-full max-w-md place-items-center px-4 py-8">
      <form
        className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={onSubmit}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
          PaperLens
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
          Log In
        </h1>

        <label className="mt-6 grid gap-2 text-sm font-semibold text-slate-800">
          Email
          <input
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            className="min-h-11 rounded-md border border-slate-300 px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </label>

        <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-800">
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(event) => updateField("password", event.target.value)}
            className="min-h-11 rounded-md border border-slate-300 px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </label>

        {error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-6 w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Logging in..." : "Log In"}
        </button>

        <button
          type="button"
          onClick={onShowSignup}
          className="mt-4 w-full rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-indigo-500 hover:text-indigo-700"
        >
          Create an account
        </button>
      </form>
    </section>
  );
}

export default Login;
