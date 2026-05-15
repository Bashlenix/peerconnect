import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { askAI } from "@/api/ai";
import type { AiAskResponse } from "@peerconnect/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function authorName(author: { firstName: string | null; lastName: string | null }): string {
  if (author.firstName && author.lastName) return `${author.firstName} ${author.lastName}`;
  if (author.firstName) return author.firstName;
  return "Anonymous";
}

export default function AskPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<AiAskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSubmitted(false);
    try {
      const data = await askAI(query.trim());
      setResult(data);
      setSubmitted(true);
    } catch (err) {
      setError((err as Error).message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold shrink-0">PeerConnect</h1>
        <Link to="/feed" className="text-sm text-blue-600 hover:underline shrink-0">
          ← Back to feed
        </Link>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <h2 className="text-lg font-semibold">Ask the community</h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What would you like to know?"
            rows={4}
            className="resize-none"
          />
          <Button type="submit" disabled={loading || !query.trim()}>
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching…
              </span>
            ) : (
              "Ask"
            )}
          </Button>
        </form>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {submitted && result && result.confidence !== "none" && (
          <div className="space-y-4">
            <div className="rounded-md border bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{result.answer}</p>
            </div>

            {result.sources.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Sources</p>
                <ul className="space-y-1">
                  {result.sources.map((source) => (
                    <li key={source.id}>
                      <Link
                        to={"/posts/" + source.id}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        See post by {authorName(source.author)} →
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {submitted && result && result.confidence === "none" && (
          <div className="rounded-md border bg-white p-6 text-center shadow-sm space-y-2">
            <p className="text-sm text-gray-600">
              No answers found yet — be the first to post this question
            </p>
            <Link to="/feed" className="text-sm text-blue-600 hover:underline">
              Go to feed →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
