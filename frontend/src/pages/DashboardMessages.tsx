import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Heart, Send, Trash2, Wand2, X } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { apiDelete, apiGet, apiPatch, ApiError } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import type { Message, MessageStatus } from "@/lib/types";

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function DashboardMessages() {
  const { data: me } = useMe();
  const [tab, setTab] = useState<MessageStatus>("pending");
  const [answerFor, setAnswerFor] = useState<Message | null>(null);
  const [answer, setAnswer] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: messages, isLoading } = useQuery({
    queryKey: ["my-messages", tab],
    queryFn: () => apiGet<Message[]>(`/me/messages?status=${tab}`),
    enabled: !!me,
  });

  const moderate = useMutation({
    mutationFn: ({ id, action, answerText }: { id: string; action: string; answerText?: string }) =>
      apiPatch<Message>(`/me/messages/${id}`, { action, answer: answerText ?? "" }),
    onSuccess: (message, vars) => {
      toast.success(
        vars.action === "publish"
          ? "Published — your story is ready to design"
          : vars.action === "reject"
            ? "Marked as rejected"
            : vars.action === "favorite"
              ? "Added to favourites"
              : "Removed from favourites"
      );
      setAnswerFor(null);
      setAnswer("");
      void queryClient.invalidateQueries({ queryKey: ["my-messages"] });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
      if (vars.action === "publish") {
        navigate("/dashboard/story-studio", {
          state: {
            question: message.content,
            answer: message.answer || vars.answerText || "",
            username: me?.username ?? "",
          },
        });
      }
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.detail : "Action failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/me/messages/${id}`),
    onSuccess: () => {
      toast.success("Message deleted");
      void queryClient.invalidateQueries({ queryKey: ["my-messages"] });
    },
  });

  return (
    <DashboardShell active="Messages">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">Anonymous inbox</h1>
          <p className="mt-1 text-muted-foreground">
            Messages arrive anonymously. Publish with an answer to grow your public Q&A wall.
          </p>
        </header>

        <Tabs value={tab} onValueChange={(v) => setTab(v as MessageStatus)}>
          <TabsList data-testid="messages-tabs">
            <TabsTrigger value="pending" data-testid="messages-tab-pending">
              Pending
            </TabsTrigger>
            <TabsTrigger value="published" data-testid="messages-tab-published">
              Published
            </TabsTrigger>
            <TabsTrigger value="rejected" data-testid="messages-tab-rejected">
              Rejected
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-3" data-testid="message-list">
          {isLoading && [0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
          {messages?.length === 0 && (
            <p className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground" data-testid="messages-empty">
              Nothing in {tab}. Share your profile link to get the messages flowing.
            </p>
          )}
          {messages?.map((message) => (
            <article
              key={message.id}
              className="rounded-2xl border bg-card p-4"
              data-testid={`message-card-${message.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{message.sender_name}</span>
                    · {timeAgo(message.created_at)}
                    {message.status !== "pending" && (
                      <Badge variant="secondary" className="capitalize">
                        {message.status}
                      </Badge>
                    )}
                    {message.favorite && <Heart className="size-3.5 text-rose-400" fill="currentColor" />}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed" data-testid="message-content">
                    {message.content}
                  </p>
                  {message.answer && (
                    <p className="mt-2 rounded-xl bg-muted px-3 py-2 text-sm" data-testid="message-answer">
                      <span className="font-semibold">Your answer:</span> {message.answer}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {message.status !== "published" && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setAnswerFor(message);
                      setAnswer(message.answer ?? "");
                    }}
                    data-testid={`message-answer-button-${message.id}`}
                  >
                    <Check className="size-4" /> {message.status === "rejected" ? "Restore & answer" : "Answer & publish"}
                  </Button>
                )}
                {message.status === "pending" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => moderate.mutate({ id: message.id, action: "reject" })}
                    data-testid={`message-reject-button-${message.id}`}
                  >
                    <X className="size-4" /> Reject
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    moderate.mutate({ id: message.id, action: message.favorite ? "unfavorite" : "favorite" })
                  }
                  data-testid={`message-favorite-button-${message.id}`}
                >
                  <Heart className="size-4" fill={message.favorite ? "currentColor" : "none"} />
                  {message.favorite ? "Favourited" : "Favourite"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove.mutate(message.id)}
                  data-testid={`message-delete-button-${message.id}`}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
                <Link
                  to="/dashboard/story-studio"
                  state={{ question: message.content, answer: message.answer ?? "", username: me?.username ?? "" }}
                  className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  data-testid={`message-story-button-${message.id}`}
                >
                  <Wand2 className="size-3.5" /> Make it a story
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* answer & publish dialog */}
      <Dialog open={!!answerFor} onOpenChange={(open) => !open && setAnswerFor(null)}>
        <DialogContent className="sm:max-w-md" data-testid="answer-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Answer publicly</DialogTitle>
            <DialogDescription>
              Your answer appears on your profile, then opens Story Studio so you can make a shareable Q&A story.
            </DialogDescription>
          </DialogHeader>
          {answerFor && (
            <>
              <p className="rounded-xl bg-muted px-3 py-2 text-sm" data-testid="answer-dialog-question">
                “{answerFor.content}”
              </p>
              <div className="space-y-2">
                <Label htmlFor="answer-text">Your answer</Label>
                <Textarea
                  id="answer-text"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={3}
                  maxLength={400}
                  placeholder="Say it with your chest…"
                  data-testid="answer-textarea"
                />
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAnswerFor(null)} data-testid="answer-cancel-button">
              <Send className="hidden" /> Cancel
            </Button>
            <Button
              onClick={() => answerFor && moderate.mutate({ id: answerFor.id, action: "publish", answerText: answer })}
              disabled={moderate.isPending || !answer.trim()}
              data-testid="answer-publish-button"
            >
              Publish & make story
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
