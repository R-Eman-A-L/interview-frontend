export type VoiceSupport =
| {supported: true }
| { supported: false; reason: "no-window" | "no-speech-synthesis" };

export type SpeakResult =
| { ok: true }
| { ok: false; reason: "unsupported" | "empty-text"|  "not-allowed" | "speak-error" };

export class InterviewVoice {
    private synthesis: SpeechSynthesis | null;

    constructor() {
        if (typeof window === "undefined"){
            this.synthesis = null;
            return;
        }
        this.synthesis = window.speechSynthesis ?? null;
    }

    support(): VoiceSupport {
        if (typeof window === "undefined") return { supported: false, reason: "no-window" };
        if (!this.synthesis) return { supported: false, reason: "no-speech-synthesis" };
        return {supported: true };
    }

    cancel(): void {
        try {
            this.synthesis?.cancel();
        } catch {
            
        }
    }

    speak(text: string): Promise<SpeakResult> {
    if (typeof window === "undefined" || !this.synthesis) {
      return Promise.resolve({ ok: false, reason: "unsupported" });
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return Promise.resolve({ ok: false, reason: "empty-text" });
    }

    this.cancel();

    return new Promise((resolve) => {
      try {
        const utterance = new SpeechSynthesisUtterance(trimmed);

        utterance.onend = () => {
          resolve({ ok: true });
        };

        utterance.onerror = (event: any) => {
          const raw =
            String(event?.error ?? "") +
            " " +
            String(event?.message ?? "") +
            " " +
            String((event as any)?.name ?? "");

          const msg = raw.toLowerCase();

          // Browser autoplay / user-gesture restriction
          if (
            msg.includes("not-allowed") ||
            msg.includes("not allowed") ||
            msg.includes("gesture") ||
            msg.includes("user")
          ) {
            resolve({ ok: false, reason: "not-allowed" });
            return;
          }

          resolve({ ok: false, reason: "speak-error" });
        };

        this.synthesis?.speak(utterance);
      } catch (e: any) {
        const msg = String(e?.message ?? "").toLowerCase();
        if (
          msg.includes("not-allowed") ||
          msg.includes("not allowed") ||
          msg.includes("gesture") ||
          msg.includes("user")
        ) {
          resolve({ ok: false, reason: "not-allowed" });
          return;
        }
        resolve({ ok: false, reason: "speak-error" });
      }
    });
  }

}

export const interviewer = new InterviewVoice();