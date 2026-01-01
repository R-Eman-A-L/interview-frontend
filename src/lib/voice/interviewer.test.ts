import { describe, it, expect } from "vitest"
import { InterviewVoice } from "./interviewer"

describe("InterviewerVoice", () => {
    it("can be construted without crashing", () => {
        const interviewerVoice = new InterviewVoice();
        expect(interviewerVoice).toBeDefined();
    });

    it("reports suport status safely", () => {
        const interviewerVoice = new InterviewVoice();
        const supportStatus = interviewerVoice.support();

        expect(supportStatus).toHaveProperty("supported");
        expect(typeof supportStatus.supported).toBe("boolean");
    });

    it("fails safely when asked to speak empty text", async () => {
        const interviewerVoice = new InterviewVoice();
        const SPeakResult = await interviewerVoice.speak("    ");

        expect(SPeakResult.ok).toBe(false);
    });
});