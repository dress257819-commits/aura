import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  ArrowUpRight, Check, Clipboard, Download, Instagram, Link2, MessageCircle, Send,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMe } from "@/lib/hooks";

type StoryDraft = {
  question: string;
  answer: string;
  username: string;
};

type StoryTheme = "sunset" | "aurora" | "noir" | "bloom" | "ocean" | "golden";
type StoryTemplate = "invite" | "answer";

const SAMPLE_QUESTION = "what's one thing you wish more people knew about you?";
const SAMPLE_ANSWER = "I'm still figuring things out, and that's okay. I'm proud of how far I've come.";

const STORY_THEMES: { id: StoryTheme; label: string; gradient: string }[] = [
  { id: "sunset", label: "Afterglow", gradient: "linear-gradient(135deg, #ed357a, #ff8739)" },
  { id: "aurora", label: "Aurora", gradient: "linear-gradient(135deg, #6d4aff, #26b7a5)" },
  { id: "noir", label: "Noir", gradient: "linear-gradient(135deg, #272332, #76607e)" },
  { id: "bloom", label: "Bloom", gradient: "linear-gradient(135deg, #f35e91, #ffc4a4)" },
  { id: "ocean", label: "Ocean", gradient: "linear-gradient(135deg, #176b87, #83d8d0)" },
  { id: "golden", label: "Golden", gradient: "linear-gradient(135deg, #65421c, #edc567)" },
];

type ThemeColors = { stops: [string, string, string]; wash: string; accent: string };
const THEME_COLORS: Record<StoryTheme, ThemeColors> = {
  sunset: { stops: ["#171421", "#8a3445", "#f47750"], wash: "rgba(54, 17, 35, 0.52)", accent: "#fa5971" },
  aurora: { stops: ["#101b2d", "#31576f", "#48a99d"], wash: "rgba(12, 31, 48, 0.55)", accent: "#78d8c0" },
  noir: { stops: ["#17151e", "#35303d", "#76607e"], wash: "rgba(15, 13, 19, 0.58)", accent: "#d0a6d9" },
  bloom: { stops: ["#281323", "#a54868", "#f29b89"], wash: "rgba(58, 15, 41, 0.48)", accent: "#fa79a4" },
  ocean: { stops: ["#0b202e", "#176b87", "#83d8d0"], wash: "rgba(8, 29, 47, 0.5)", accent: "#53c3d2" },
  golden: { stops: ["#21190e", "#765324", "#edc567"], wash: "rgba(45, 28, 8, 0.5)", accent: "#e5b54d" },
};

function isStoryDraft(value: unknown): value is Partial<StoryDraft> {
  return typeof value === "object" && value !== null;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";

  const words = text.trim().split(/\s+/).flatMap((word) => {
    if (ctx.measureText(word).width <= maxWidth) return [word];
    const chunks: string[] = [];
    let chunk = "";
    for (const character of word) {
      if (chunk && ctx.measureText(chunk + character).width > maxWidth) {
        chunks.push(chunk);
        chunk = "";
      }
      chunk += character;
    }
    if (chunk) chunks.push(chunk);
    return chunks;
  });

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fitLines(ctx: CanvasRenderingContext2D, lines: string[], maxWidth: number, maxLines: number): string[] {
  if (lines.length <= maxLines) return lines;
  const visible = lines.slice(0, maxLines);
  let lastLine = visible[maxLines - 1];
  while (lastLine && ctx.measureText(`${lastLine}…`).width > maxWidth) {
    lastLine = Array.from(lastLine).slice(0, -1).join("");
  }
  visible[maxLines - 1] = `${lastLine}…`;
  return visible;
}

function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxLines: number,
  initialSize: number,
  minSize: number,
  color: string,
) {
  let fontSize = initialSize;
  ctx.font = `600 ${fontSize}px 'DM Sans Variable', sans-serif`;
  let lines = wrapText(ctx, text, maxWidth);
  while (lines.length > maxLines && fontSize > minSize) {
    fontSize -= 2;
    ctx.font = `600 ${fontSize}px 'DM Sans Variable', sans-serif`;
    lines = wrapText(ctx, text, maxWidth);
  }
  ctx.fillStyle = color;
  fitLines(ctx, lines, maxWidth, maxLines).forEach((line, index) => {
    ctx.fillText(line, x, y + index * fontSize * 1.24);
  });
}

function drawStory(
  canvas: HTMLCanvasElement,
  template: StoryTemplate,
  headline: string,
  question: string,
  answer: string,
  username: string,
  displayName: string,
  theme: StoryTheme,
  avatar: HTMLImageElement | null,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = 1080;
  const height = 1920;
  canvas.width = width;
  canvas.height = height;
  const colors = THEME_COLORS[theme];

  const background = ctx.createLinearGradient(0, 0, width * 0.86, height);
  background.addColorStop(0, colors.stops[0]);
  background.addColorStop(0.55, colors.stops[1]);
  background.addColorStop(1, colors.stops[2]);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  if (avatar) {
    const scale = Math.max(width / avatar.naturalWidth, height / avatar.naturalHeight) * 1.08;
    const imageWidth = avatar.naturalWidth * scale;
    const imageHeight = avatar.naturalHeight * scale;
    ctx.save();
    ctx.filter = "blur(36px) saturate(1.2)";
    ctx.drawImage(avatar, (width - imageWidth) / 2, (height - imageHeight) / 2, imageWidth, imageHeight);
    ctx.restore();
  }

  ctx.fillStyle = colors.wash;
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(width * 0.5, 720, 30, width * 0.5, 720, 780);
  glow.addColorStop(0, "rgba(255, 255, 255, 0.12)");
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.font = "700 29px 'DM Sans Variable', sans-serif";
  ctx.fillText("A U R A", width / 2, 112);
  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  ctx.font = "500 18px 'DM Sans Variable', sans-serif";
  ctx.fillText("A LITTLE SOMETHING FROM MY INBOX", width / 2, 152);

  const avatarX = width / 2;
  const avatarY = 298;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, 126, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, 116, 0, Math.PI * 2);
  if (avatar) {
    ctx.save();
    ctx.clip();
    const sourceSize = Math.min(avatar.naturalWidth, avatar.naturalHeight) * 0.68;
    const sourceX = (avatar.naturalWidth - sourceSize) / 2;
    const sourceY = (avatar.naturalHeight - sourceSize) * 0.25;
    ctx.drawImage(
      avatar,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      avatarX - 116,
      avatarY - 116,
      232,
      232,
    );
    ctx.restore();
  } else {
    ctx.fillStyle = colors.stops[1];
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "700 66px 'DM Sans Variable', sans-serif";
    ctx.fillText((displayName.trim().charAt(0) || username.charAt(0) || "A").toUpperCase(), avatarX, avatarY + 22);
  }

  if (template === "invite") {
    ctx.fillStyle = "rgba(255, 255, 255, 0.97)";
    ctx.font = "700 30px 'DM Sans Variable', sans-serif";
    ctx.fillText(displayName, width / 2, 466);
    ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
    ctx.font = "500 21px 'DM Sans Variable', sans-serif";
    ctx.fillText(`@${username.replace(/^@/, "")}`, width / 2, 502);
    drawTextBlock(ctx, headline, width / 2, 578, 900, 2, 74, 48, "#fff");

    const cardX = 82;
    const cardY = 752;
    const cardWidth = width - cardX * 2;
    const cardHeight = 400;
    ctx.shadowColor = "rgba(12, 8, 20, 0.28)";
    ctx.shadowBlur = 52;
    ctx.shadowOffsetY = 24;
    ctx.fillStyle = "#fffaf6";
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 42);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 42);
    ctx.clip();
    const banner = ctx.createLinearGradient(cardX, cardY, cardX + cardWidth, cardY + 148);
    banner.addColorStop(0, colors.accent);
    banner.addColorStop(1, colors.stops[2]);
    ctx.fillStyle = banner;
    ctx.fillRect(cardX, cardY, cardWidth, 148);
    ctx.restore();

    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "700 20px 'DM Sans Variable', sans-serif";
    ctx.fillText("YOUR ANONYMOUS INBOX", width / 2, cardY + 58);
    drawTextBlock(ctx, "A private little space to say what's on your mind.", width / 2, cardY + 248, cardWidth - 120, 3, 42, 34, "#302735");

    const stickerX = 166;
    const stickerY = 1338;
    const stickerWidth = width - stickerX * 2;
    ctx.shadowColor = "rgba(12, 8, 20, 0.22)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.roundRect(stickerX, stickerY, stickerWidth, 114, 28);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(stickerX + 64, stickerY + 57, 27, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(stickerX + 64, stickerY + 57, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(stickerX + 64, stickerY + 68);
    ctx.lineTo(stickerX + 64, stickerY + 81);
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillStyle = "#302735";
    ctx.font = "700 30px 'DM Sans Variable', sans-serif";
    ctx.fillText(`AURA.LINK/@${username.replace(/^@/, "")}`, stickerX + 112, stickerY + 67);

    ctx.strokeStyle = "rgba(255, 250, 246, 0.92)";
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    [-100, 0, 100].forEach((offset, index) => {
      const x = width / 2 + offset;
      const startY = 1288 + (index === 1 ? 14 : 0);
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, 1252);
      ctx.lineTo(x - 17, 1272);
      ctx.moveTo(x, 1252);
      ctx.lineTo(x + 17, 1272);
      ctx.stroke();
    });

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255, 255, 255, 0.97)";
    ctx.font = "700 27px 'DM Sans Variable', sans-serif";
    ctx.fillText("send me an anonymous message", width / 2, 1560);
    ctx.fillStyle = "rgba(255, 255, 255, 0.74)";
    ctx.font = "500 20px 'DM Sans Variable', sans-serif";
    ctx.fillText("tap the link sticker to say hi", width / 2, 1600);
    ctx.font = "600 18px 'DM Sans Variable', sans-serif";
    ctx.fillText("AURA  ·  A LITTLE MORE YOU", width / 2, 1780);
    return;
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
  ctx.font = "600 24px 'DM Sans Variable', sans-serif";
  ctx.fillText(`@${username.replace(/^@/, "")}`, width / 2, 466);

  ctx.fillStyle = "#fff";
  ctx.font = "700 48px 'DM Sans Variable', sans-serif";
  ctx.fillText("a little question", width / 2, 492);
  ctx.fillText("from my inbox…", width / 2, 548);

  const cardX = 68;
  const cardY = 606;
  const cardWidth = width - cardX * 2;
  const cardHeight = 816;
  ctx.shadowColor = "rgba(12, 8, 20, 0.28)";
  ctx.shadowBlur = 52;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = "#fffaf6";
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 42);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 42);
  ctx.clip();
  const banner = ctx.createLinearGradient(cardX, cardY, cardX + cardWidth, cardY + 440);
  banner.addColorStop(0, colors.accent);
  banner.addColorStop(1, colors.stops[2]);
  ctx.fillStyle = banner;
  ctx.fillRect(cardX, cardY, cardWidth, 440);
  ctx.restore();

  const centerX = width / 2;
  const textWidth = cardWidth - 116;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.font = "700 19px 'DM Sans Variable', sans-serif";
  ctx.fillText("THE ANONYMOUS QUESTION", centerX, 682);
  drawTextBlock(ctx, question, centerX, 766, textWidth, 5, 50, 34, "#fff");

  ctx.fillStyle = "#ad7860";
  ctx.font = "700 18px 'DM Sans Variable', sans-serif";
  ctx.fillText("MY ANSWER", centerX, 1112);
  drawTextBlock(ctx, answer, centerX, 1184, textWidth, 5, 44, 30, "#302735");

  const stickerX = 202;
  const stickerY = 1530;
  const stickerWidth = width - stickerX * 2;
  ctx.shadowColor = "rgba(12, 8, 20, 0.22)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.roundRect(stickerX, stickerY, stickerWidth, 104, 24);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.arc(stickerX + 58, stickerY + 52, 25, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(stickerX + 58, stickerY + 52, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(stickerX + 58, stickerY + 62);
  ctx.lineTo(stickerX + 58, stickerY + 74);
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.fillStyle = "#352b37";
  ctx.font = "700 26px 'DM Sans Variable', sans-serif";
  ctx.fillText(`AURA.LINK/@${username.replace(/^@/, "")}`, stickerX + 104, stickerY + 60);

  ctx.strokeStyle = "rgba(255, 250, 246, 0.9)";
  ctx.lineWidth = 13;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  [-80, 0, 80].forEach((offset, index) => {
    const x = width / 2 + offset;
    const startY = 1488 + (index === 1 ? 14 : 0);
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, 1460);
    ctx.lineTo(x - 15, 1477);
    ctx.moveTo(x, 1460);
    ctx.lineTo(x + 15, 1477);
    ctx.stroke();
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  ctx.font = "700 26px 'DM Sans Variable', sans-serif";
  ctx.fillText("send me an anonymous note too", width / 2, 1702);
  ctx.fillStyle = "rgba(255, 255, 255, 0.68)";
  ctx.font = "500 19px 'DM Sans Variable', sans-serif";
  ctx.fillText("tap the link sticker to say hi", width / 2, 1742);
}

export default function StoryStudio() {
  const location = useLocation();
  const { data: me } = useMe();
  const draft = isStoryDraft(location.state) ? location.state : {};
  const hasAnswerDraft = typeof draft.question === "string" && typeof draft.answer === "string";
  const [template, setTemplate] = useState<StoryTemplate>(hasAnswerDraft ? "answer" : "invite");
  const [headline, setHeadline] = useState("send me anonymous messages!");
  const [question, setQuestion] = useState(typeof draft.question === "string" ? draft.question : SAMPLE_QUESTION);
  const [answer, setAnswer] = useState(typeof draft.answer === "string" ? draft.answer : SAMPLE_ANSWER);
  const [theme, setTheme] = useState<StoryTheme>("sunset");
  const [avatar, setAvatar] = useState<HTMLImageElement | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const [storyBlob, setStoryBlob] = useState<Blob | null>(null);
  const username = (typeof draft.username === "string" && draft.username) || me?.username || "yourname";
  const displayName = me?.name || username;
  const profileLink = `${window.location.origin}/u/${username.replace(/^@/, "")}`;
  const storyLink = template === "invite" ? `${profileLink}?ask=1` : profileLink;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setAvatar(null);
    setPhotoError(false);
    if (!me?.avatar_url) return;

    let isCurrent = true;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (isCurrent) setAvatar(image);
    };
    image.onerror = () => {
      if (isCurrent) setPhotoError(true);
    };
    image.src = me.avatar_url;

    return () => {
      isCurrent = false;
    };
  }, [me?.avatar_url]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setStoryBlob(null);
      return;
    }

    let isCurrent = true;
    setStoryBlob(null);
    void document.fonts.ready.then(() => {
      if (!isCurrent) return;
      drawStory(
        canvas,
        template,
        headline.trim() || "send me anonymous messages!",
        question.trim() || "your question goes here",
        answer.trim() || "your answer goes here",
        username,
        displayName,
        theme,
        avatar,
      );
      const canExport = template === "invite"
        ? Boolean(headline.trim())
        : Boolean(question.trim() && answer.trim());
      if (!canExport) return;
      canvas.toBlob((blob) => {
        if (isCurrent) setStoryBlob(blob);
      }, "image/png");
    });

    return () => {
      isCurrent = false;
    };
  }, [answer, avatar, displayName, headline, question, template, theme, username]);

  const downloadStory = () => {
    if (!storyBlob) {
      toast.error("Your story image could not be created. Please try again.");
      return;
    }

    const url = URL.createObjectURL(storyBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `aura-story-${username.replace(/[^a-z0-9_-]/gi, "")}.png`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Your story is ready to post");
  };

  const shareStory = () => {
    if (!storyBlob) {
      toast.error("Your story image could not be created. Please try again.");
      return;
    }

    const safeUsername = username.replace(/[^a-z0-9_-]/gi, "") || "creator";
    const file = new File([storyBlob], `aura-story-${safeUsername}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      void navigator.share({ files: [file], title: "My AURA story" }).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        toast.error("Could not open the share sheet. Download your story and upload it to Instagram.");
      });
      return;
    }

    downloadStory();
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  };

  const copyProfileLink = async () => {
    try {
      await navigator.clipboard.writeText(storyLink);
      toast.success(template === "invite"
        ? "Direct message link copied — add it with Instagram's Link sticker"
        : "Profile link copied — add it with Instagram's Link sticker");
    } catch {
      toast.error("Couldn't copy the profile link. You can copy it from your profile page.");
    }
  };

  return (
    <DashboardShell active="Story Studio">
      <div className="mx-auto max-w-5xl space-y-8">
        <header>
          <p className="label-caps text-muted-foreground">A little more you</p>
          <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight">Story Studio</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Invite your people into a conversation or turn a favorite reply into a story worth sharing.
          </p>
        </header>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <section className="space-y-5 rounded-3xl border bg-card p-5 sm:p-6">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/60 p-1.5">
              <Button
                type="button"
                variant={template === "invite" ? "default" : "ghost"}
                className="h-auto min-h-14 flex-col items-start gap-0.5 px-3 py-2.5 text-left"
                aria-pressed={template === "invite"}
                onClick={() => setTemplate("invite")}
                data-testid="story-template-invite"
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Send className="size-4" /> Invite questions
                </span>
                <span className="text-xs opacity-75">Start a conversation</span>
              </Button>
              <Button
                type="button"
                variant={template === "answer" ? "default" : "ghost"}
                className="h-auto min-h-14 flex-col items-start gap-0.5 px-3 py-2.5 text-left"
                aria-pressed={template === "answer"}
                onClick={() => setTemplate("answer")}
                data-testid="story-template-answer"
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <MessageCircle className="size-4" /> Share an answer
                </span>
                <span className="text-xs opacity-75">Reply to a question</span>
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                {template === "invite" ? <Send className="size-5" /> : <MessageCircle className="size-5" />}
              </span>
              <div>
                <h2 className="font-heading text-lg font-semibold">
                  {template === "invite" ? "Open the conversation" : "Your story, your voice"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {template === "invite"
                    ? "One direct link opens your anonymous message form—no extra question or detour."
                    : "Turn a real inbox moment into something worth sharing."}
                </p>
              </div>
            </div>

            {template === "invite" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="story-headline">Your invite</Label>
                  <Textarea
                    id="story-headline"
                    value={headline}
                    onChange={(event) => setHeadline(event.target.value)}
                    maxLength={90}
                    rows={2}
                    placeholder="Send me anonymous messages!"
                    data-testid="story-headline"
                  />
                  <p className="text-right text-xs text-muted-foreground">{headline.length}/90</p>
                </div>
                <p className="rounded-xl border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                  The link sticker opens your profile with the anonymous message box ready to use.
                </p>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="story-question">The question</Label>
                  <Textarea
                    id="story-question"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    maxLength={500}
                    rows={4}
                    placeholder="Add the question from your inbox..."
                    data-testid="story-question"
                  />
                  <p className="text-right text-xs text-muted-foreground">{question.length}/500</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="story-answer">Your answer</Label>
                  <Textarea
                    id="story-answer"
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    maxLength={400}
                    rows={5}
                    placeholder="Write an answer worth sharing..."
                    data-testid="story-answer"
                  />
                  <p className="text-right text-xs text-muted-foreground">{answer.length}/400</p>
                </div>
              </>
            )}

            <div className="space-y-3">
              <div>
                <Label>Choose your story mood</Label>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {STORY_THEMES.map((preset) => (
                    <Button
                      key={preset.id}
                      type="button"
                      variant="outline"
                      aria-pressed={theme === preset.id}
                      className={`h-auto flex-col gap-2 p-2.5 ${theme === preset.id ? "border-primary ring-2 ring-primary/20" : ""}`}
                      onClick={() => setTheme(preset.id)}
                      data-testid={`story-theme-${preset.id}`}
                    >
                      <span className="h-10 w-full rounded-lg" style={{ background: preset.gradient }} />
                      <span className="flex items-center gap-1 text-xs">
                        {theme === preset.id && <Check className="size-3" />}
                        {preset.label}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
              {photoError && (
                <p className="text-xs text-muted-foreground">
                  Your profile photo couldn&apos;t be added to the image, so the selected color mood is being used.
                </p>
              )}
            </div>

            <div className="space-y-3 border-t pt-5">
              <Button
                className="w-full"
                size="lg"
                onClick={downloadStory}
                disabled={!storyBlob}
                data-testid="story-download-button"
              >
                <Download className="size-4" /> Download story PNG
              </Button>
              <Button
                className="w-full"
                variant="outline"
                size="lg"
                onClick={shareStory}
                disabled={!storyBlob}
                data-testid="story-instagram-button"
              >
                <Instagram className="size-4" /> Share to Instagram <ArrowUpRight className="size-4" />
              </Button>
              <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-background text-primary">
                  <Link2 className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">Your profile link</p>
                  <p className="select-all break-all text-xs text-muted-foreground">{storyLink}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void copyProfileLink()}
                  data-testid="story-copy-link-button"
                >
                  <Clipboard className="size-3.5" /> Copy
                </Button>
              </div>
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                {template === "invite"
                  ? "Add this direct link with Instagram's Link sticker. It opens the anonymous message box."
                  : "Add your copied profile link with Instagram's Link sticker so people can send you a note."}
              </p>
            </div>
          </section>

          <aside className="space-y-3 lg:sticky lg:top-20">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold">Story preview</h2>
              <span className="text-xs text-muted-foreground">9:16 · 1080 × 1920</span>
            </div>
            <div className="mx-auto aspect-[9/16] w-full max-w-[360px] overflow-hidden rounded-[2rem] border-[5px] border-card bg-muted shadow-2xl">
              <canvas
                ref={canvasRef}
                className="block size-full"
                aria-label={template === "invite"
                ? `Question invite story preview. ${headline}. Link opens the anonymous message form.`
                  : `Question and answer story preview. Question: ${question}. Answer: ${answer}`}
                data-testid="story-preview"
              />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {template === "invite"
                ? "Friends tap your link to open your anonymous message box."
                : "Your profile photo becomes the softly blurred story backdrop."}
            </p>
          </aside>
        </div>
      </div>
    </DashboardShell>
  );
}
