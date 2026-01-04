export type VoiceAnswerSupport =
	| { supported: true }
	| {
			supported: false;
			reason: 'no-window' | 'no-getusermedia' | 'no-mediaRecorder' | 'no-speech-recognition';
	  };

export type StartResult =
	| { ok: true }
	| { ok: false; reason: 'permission-denied' | 'device-error' | 'unsupported' | 'busy' };

export type StopResult =
	| { ok: true; transcript: string; audioBlob: Blob | null }
	| { ok: false; reason: 'not-recording' };

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
	const anyWindow = window as any;
	return (anyWindow.SpeechRecognition ??
		anyWindow.webkitSpeechRecognition ??
		null) as SpeechRecognitionCtor | null;
}

export class AsnwerRecorder {
	private stream: MediaStream | null = null;
	private mediaRecorder: MediaRecorder | null = null;
	private chuncks: BlobPart[] = [];

	private recognition: SpeechRecognition | null = null;
	private recognitionSupported = false;

	private isRecording = false;
	private transcriptParts: string[] = [];
	private lastError: string | null = null;

	support(): VoiceAnswerSupport {
		if (typeof window === 'undefined') return { supported: false, reason: 'no-window' };
		if (!navigator.mediaDevices?.getDisplayMedia)
			return { supported: false, reason: 'no-mediaRecorder' };
		if (typeof MediaRecorder === 'undefined')
			return { supported: false, reason: 'no-mediaRecorder' };
		if (!getSpeechRecognitionCtor()) return { supported: false, reason: 'no-speech-recognition' };
		return { supported: true };
	}

	get recording(): boolean {
		return this.isRecording;
	}

	async start(): Promise<StartResult> {
		if (this.isRecording) return { ok: false, reason: 'busy' };

		const support = this.support();
		if (!support.supported) return { ok: false, reason: 'unsupported' };

		this.lastError = null;
		this.transcriptParts = [];
		this.chuncks = [];

		try {
			this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch (e: any) {
			const name = String(e?.name ?? '').toLowerCase();
			if (name.includes('notallowed') || name.includes('permission')) {
				return { ok: false, reason: 'permission-denied' };
			}
			return { ok: false, reason: 'device-error' };
		}

		try {
			this.mediaRecorder = new MediaRecorder(this.stream);
			this.mediaRecorder.ondataavailable = (evt) => {
				if (evt.data && evt.data.size > 0) this.chuncks.push(evt.data);
			};
		} catch {
			this.cleanup();
			return { ok: false, reason: 'unsupported' };
		}

		const Ctor = getSpeechRecognitionCtor();
		if (Ctor) {
			this.recognitionSupported = true;
			this.recognition = new Ctor();
			this.recognition.continuous = true;
			this.recognition.interimResults = false;
			this.recognition.lang = 'en-US';

			this.recognition.onresult = (event: SpeechRecognitionEvent) => {
				for (let i = event.resultIndex; i < event.results.length; i++) {
					const res = event.results[i];
					if (res.isFinal) {
						const text = String(res[0]?.transcript ?? '').trim();
						if (text) this.transcriptParts.push(text);
					}
				}
			};

			this.recognition.onerror = (event: any) => {
				this.lastError = String(event?.error ?? 'speech-error');
			};
		}

		this.isRecording = true;
		this.mediaRecorder.start();

		if (this.recognitionSupported && this.recognition) {
			try {
				this.recognition.start();
			} catch {}
		}

		return { ok: true };
	}

	async stop(): Promise<StopResult> {
		if (!this.isRecording) return { ok: false, reason: 'not-recording' };
		this.isRecording = false;

		if (this.recognitionSupported && this.recognition) {
			try {
				this.recognition.stop();
			} catch {}
		}

		const mediaRecorder = this.mediaRecorder;
		const stream = this.stream;

		const audioBlob = await new Promise<Blob | null>((resolve) => {
			if (!mediaRecorder) return resolve(null);

			const finalize = () => {
				try {
					const type = mediaRecorder.mimeType || 'audio/webm';
					resolve(new Blob(this.chuncks, { type }));
				} catch {
					resolve(null);
				}
			};

			mediaRecorder.onstop = finalize;

			try {
				mediaRecorder.stop();
			} catch {
				finalize();
			}
		});

		try {
			stream?.getTracks().forEach((track) => track.stop());
		} catch {}

		const transcript = this.transcriptParts.join(' ').trim();

		this.cleanup();

		return { ok: true, transcript, audioBlob };
	}

	private cleanup(): void {
		this.mediaRecorder = null;
		this.stream = null;
		this.chuncks = [];
		this.recognition = null;
		this.recognitionSupported = false;
		this.lastError = null;
		this.transcriptParts = [];
	}
}

export const asnwerRecorder = new AsnwerRecorder();
