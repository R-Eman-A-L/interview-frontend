<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { nextQuestion, answerQuestion } from '$lib/api/interview';
	import type { NextQuestionResponse } from '$lib/api/types';
	import { onMount, onDestroy } from 'svelte';
	import { interviewer } from '$lib/voice/interviewer';
	import { browser } from '$app/environment';
	import { asnwerRecorder } from '$lib/voice/answerRecorder';

	const INTERVIEW_ID_PARM = page.params.id;
	const MAX_REPEATS_PER_QUESTION = 2;
	const POST_SPEECH_PAUSE_MS = 3000;

	if (!INTERVIEW_ID_PARM) {
		throw new Error('Interview ID is missing from route parameters.');
	}

	const INTERVIEW_ID: string = INTERVIEW_ID_PARM;

	let loading = false;
	let error: string | null = null;
	let nextQ: NextQuestionResponse | null = null;
	let submitting = false;
	let answeredText = '';
	let currentQuestion: number | null = null;
	let totalQuestions: number | null = null;
	let redirecting = false;
	let completed = false;
	let questionTextVisible = true;
	let keywordHintVisible = false;
	let lastSpokenQuestionId: string | null = null;
	let activeSpeechToken = 0;
	let isInterviewerSpeaking = false;
	let repeatCountForCurrentQuestion = 0;
	let postSpeechCueVisible = false;

	let voiceSupported = false;
	let voiceUnsupportedReason: string | null = null;
	let voiceRecoding = false;
	let voiceError: string | null = null;
	let voiceStatus: string | null = null;
	let voiceSeconds = 0;
	let voiceElapsedMs = 0;
	let voiceStartTs = 0;
	let voiceTimer: ReturnType<typeof setInterval> | null = null;

	function sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	async function loadNextQuestion(): Promise<void> {
		if (redirecting) return;

		error = null;
		loading = true;

		try {
			nextQ = await nextQuestion({ interview_id: INTERVIEW_ID });

			if (nextQ.status === 'completed') {
				redirecting = true;
				completed = true;
				currentQuestion = null;
				totalQuestions = null;
				await sleep(5000);
				await goto(`/interview/${INTERVIEW_ID}/results`);
				return;
			}

			if (nextQ.status === 'in_progress') {
				const questionIndex = nextQ.index;
				if (questionIndex === null) {
					error = 'The question index is missing.';
					currentQuestion = null;
					totalQuestions = null;
					return;
				}

				currentQuestion = questionIndex;
				totalQuestions = questionIndex + nextQ.remaining;
			} else {
				currentQuestion = null;
				totalQuestions = null;
			}
		} catch (e: any) {
			error = e?.message ?? 'Failed to load the next question.';
			nextQ = null;
		} finally {
			loading = false;
		}
	}

	async function onSubmitAnswer(): Promise<void> {
		if (!nextQ || nextQ.status !== 'in_progress') return;

		const questionId = nextQ.question_id;

		if (!questionId) {
			error = 'The question ID is missing.';
			return;
		}

		const trimmedAnswered = answeredText.trim();
		if (trimmedAnswered.length === 0) {
			error = 'Answer cannot be empty.';
			return;
		}

		error = null;
		submitting = true;

		try {
			await answerQuestion({
				interview_id: INTERVIEW_ID,
				question_id: questionId,
				answer_text: trimmedAnswered
			});

			answeredText = '';
			await loadNextQuestion(false);
		} catch (e: any) {
			error = e?.message ?? 'Failed to submit the answer.';
		} finally {
			submitting = false;
		}
	}

	function playQuestionAudio(text: string): void {
		const trimmed = text.trim();
		if (!trimmed) {
			questionTextVisible = true;
			keywordHintVisible = false;
			isInterviewerSpeaking = false;
			return;
		}

		// New "speech attempt" token
		const token = ++activeSpeechToken;

		// Voice-first reset for THIS attempt
		questionTextVisible = false;
		keywordHintVisible = false;
		isInterviewerSpeaking = true;

		interviewer.cancel();

		interviewer.speak(trimmed).then((result) => {
			// Ignore results from older speech attempts (race fix)
			if (token !== activeSpeechToken) return;

			isInterviewerSpeaking = false;

			if (result.ok) {
				keywordHintVisible = true;
			} else if (result.reason === 'not-allowed') {
				// keep voice-first; user can click Repeat once speaking isn't active
			} else {
				questionTextVisible = true;
				keywordHintVisible = false;
			}
		});
	}

	function speakQuestionOrFallback(questionId: string, questionText: string): void {
		const trimmed = questionText.trim();

		// New "speech attempt" token (race fix)
		const token = ++activeSpeechToken;

		// Voice-first reset for THIS attempt
		questionTextVisible = false;
		keywordHintVisible = false;
		isInterviewerSpeaking = true;

		interviewer.cancel();

		if (!trimmed) {
			// No text to speak => immediate text fallback
			isInterviewerSpeaking = false;
			questionTextVisible = true;
			keywordHintVisible = false;
			return;
		}

		interviewer.speak(trimmed).then(async (result) => {
			// Ignore results from older speech attempts
			if (token !== activeSpeechToken) return;

			isInterviewerSpeaking = false;

			if (result.ok) {
				postSpeechCueVisible = true;
				await sleep(POST_SPEECH_PAUSE_MS);

				if (token !== activeSpeechToken) return;

				postSpeechCueVisible = false;

				// Voice succeeded => show keywords only
				keywordHintVisible = true;
				questionTextVisible = false;
				return;
			}

			if (result.reason === 'not-allowed') {
				// Autoplay blocked by browser.
				// If user already used all repeats, we must NOT leave them stuck with hidden UI.
				if (repeatCountForCurrentQuestion >= MAX_REPEATS_PER_QUESTION) {
					keywordHintVisible = true; // show hint so they can proceed
					questionTextVisible = false; // keep voice-first feel
				}
				return;
			}

			// Other failure => text fallback
			questionTextVisible = true;
			keywordHintVisible = false;
		});
	}

	function repeatStorageKey(interviewId: string, questionId: string): string {
		return `repeatCount:${interviewId}:${questionId}`;
	}

	function loadRepeatCountFromSession(interviewId: string, questionId: string): number {
		if (!browser) return 0;
		const raw = sessionStorage.getItem(repeatStorageKey(interviewId, questionId));
		const n = raw ? Number(raw) : 0;
		return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
	}

	function saveRepeatCountToSession(interviewId: string, questionId: string, count: number): void {
		if (!browser) return;
		sessionStorage.setItem(repeatStorageKey(interviewId, questionId), String(count));
	}

	function repeatQuestion(): void {
		if (isInterviewerSpeaking) return;
		if (repeatCountForCurrentQuestion >= MAX_REPEATS_PER_QUESTION) return;

		const questionId = nextQ?.question_id;
		const questionText = nextQ?.question ?? '';
		if (!questionId) return;

		const nextCount = repeatCountForCurrentQuestion + 1;
		repeatCountForCurrentQuestion = nextCount;
		saveRepeatCountToSession(INTERVIEW_ID, questionId, nextCount);

		speakQuestionOrFallback(questionId, questionText);
	}

	function startVoiceTimer() {
		stopVoiceTimer();
		voiceElapsedMs = 0;
		voiceStartTs = performance.now();

		voiceTimer = setInterval(() => {
			voiceElapsedMs = performance.now() - voiceStartTs;
		}, 50); // 20fps → smooth but cheap
	}

	function stopVoiceTimer() {
		if (voiceTimer) {
			clearInterval(voiceTimer);
			voiceTimer = null;
		}
	}

	function formatElapsed(ms: number): string {
		const totalSeconds = ms / 1000;
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = Math.floor(totalSeconds % 60);
		const centiseconds = Math.floor((ms % 1000) / 10);

		const mm = String(minutes).padStart(2, '0');
		const ss = String(seconds).padStart(2, '00');
		const cs = String(centiseconds).padStart(2, '0');

		return `${mm}:${ss}.${cs}`;
	}

	async function startVoiceAnswer(): Promise<void> {
		voiceError = null;
		voiceStatus = null;

		if (isInterviewerSpeaking || submitting) return;
		if (voiceRecoding) return;

		const result = await asnwerRecorder.start();
		if (!result.ok) {
			if (result.reason === 'unsupported')
				voiceError = "Voice answers arent't supported in this browser. Please type your answer.";
			else if (result.reason === 'permission-denied')
				voiceError =
					'Microphone permission was denied. Enable it in your browser settings, or type your answer.';
			else if (result.reason === 'device-error')
				voiceError =
					"Couldn't access the microphone. Check your device/audio settings, or type your answer.";
			else if (result.reason === 'busy') voiceError = 'Recording is already active.';
			return;
		}

		voiceRecoding = true;
		startVoiceTimer();
	}

	async function stopVoiceAnswer(): Promise<void> {
		voiceError = null;
		voiceStatus = null;

		if (!voiceRecoding) return;

		const result = await asnwerRecorder.stop();
		voiceRecoding = false;
		stopVoiceTimer();

		if (!result.ok) {
			voiceError = "Couldn't stop recording.";
			return;
		}

		const transcript = result.transcript.trim();
		if (transcript.length > 0) {
			answeredText = transcript;
			voiceStatus = 'Transcript added. Review/edit your answer before submitting.';
		} else {
			voiceStatus = 'No speech detected. You can try again or type your answer.';
		}
	}

	$: if (
		browser &&
		nextQ?.status === 'in_progress' &&
		nextQ.question_id &&
		nextQ.question_id !== lastSpokenQuestionId
	) {
		const newQuestionId = nextQ.question_id;

		repeatCountForCurrentQuestion = loadRepeatCountFromSession(INTERVIEW_ID, newQuestionId);

		lastSpokenQuestionId = newQuestionId;

		speakQuestionOrFallback(newQuestionId, nextQ.question ?? '');
	}

	// make the function call immediately when the page is created.
	onMount(async () => {
		if (!browser) return;

		const support = asnwerRecorder.support();
		if (support.supported) {
			voiceSupported = true;
			voiceUnsupportedReason = null;
		} else {
			voiceSupported = false;
			voiceUnsupportedReason = support.reason;
		}

		loadNextQuestion();
		lastSpokenQuestionId = null;
	});

	onDestroy(() => {
		stopVoiceTimer();
		if (voiceRecoding) {
			try {
				asnwerRecorder.stop();
			} catch {}
		}
		interviewer.cancel();
	});
</script>

<h1>Interview</h1>

{#if completed}
	<p>Interview completed. Redirecting you to the results page...</p>
{:else if loading && !submitting}
	<p>Loading next question...</p>
{:else if error}
	<p style="color:red;">{error}</p>
{:else if nextQ?.status === 'in_progress'}
	<p><strong>Progress:</strong>Question {currentQuestion}/{totalQuestions}</p>
	<p><strong>Type:</strong>{nextQ.type}</p>

	{#if isInterviewerSpeaking}
		<div class="speaking-wrapper">
			<div class="speaking-indicator" aria-label="Interviewer speaking">
				<span class="bars" aria-hidden="true">
					<span class="bar"></span>
					<span class="bar"></span>
					<span class="bar"></span>
					<span class="bar"></span>
					<span class="bar"></span>
				</span>
				<span class="speaking-text">Interviewer speaking…</span>
			</div>
		</div>
	{/if}

	{#if questionTextVisible}
		<p><strong>Question:</strong>{nextQ.question}</p>
	{/if}

	{#if postSpeechCueVisible}
		<p class="interviewer-cue">Take a moment to think.</p>
	{/if}

	{#if keywordHintVisible && nextQ.keywords?.length}
		<p><strong>Keyword hint:</strong> {nextQ.keywords.join(', ')}</p>
	{/if}

	<textarea
		rows="8"
		placeholder="Type your answer here..."
		bind:value={answeredText}
		disabled={submitting || isInterviewerSpeaking}
		style="width:100%; max-width:800px;"
	></textarea>

	{#if voiceSupported}
		<div class="voice-actions">
			<button
				type="button"
				class="secondary"
				on:click={startVoiceAnswer}
				disabled={submitting || isInterviewerSpeaking || voiceRecoding}
			>
				Start recording
			</button>

			<button
				type="button"
				class="secondary"
				on:click={stopVoiceAnswer}
				disabled={submitting || isInterviewerSpeaking || !voiceRecoding}
			>
				Stop recording
			</button>

			{#if voiceRecoding}
				<div class="rec-indicator" aria-live="polite">
					<span class="rec-dot" aria-hidden="true"></span>
					<span class="rec-text">REC</span>
					<span class="rec-time">{formatElapsed(voiceElapsedMs)}</span>
				</div>
			{/if}

			{#if voiceStatus}
				<p class="voice-status">{voiceStatus}</p>
			{/if}

			{#if voiceError}
				<p class="voice-error">{voiceError}</p>
			{/if}
		</div>
	{:else if voiceUnsupportedReason}
		<p class="voice-fallback">
			Voice answers unavailable here ({voiceUnsupportedReason}). You can type your answer.
		</p>
	{/if}

	<div class="actions">
		<button
			class="primary"
			on:click={onSubmitAnswer}
			disabled={submitting || isInterviewerSpeaking}
		>
			{#if submitting}
				Submitting your answer...
			{:else}
				Submit answer
			{/if}
		</button>

		<button
			type="button"
			class="secondary"
			on:click={repeatQuestion}
			disabled={isInterviewerSpeaking || repeatCountForCurrentQuestion >= MAX_REPEATS_PER_QUESTION}
		>
			Repeat question ({repeatCountForCurrentQuestion}/{MAX_REPEATS_PER_QUESTION})
		</button>
	</div>
{:else}
	<p>Nothing to display.</p>
{/if}

<style>
	.actions {
		margin-top: 24px;
		display: flex;
		gap: 12px;
		justify-content: flex-start;
	}

	button {
		font-size: 14px;
		padding: 10px 16px;
		border-radius: 6px;
		border: none;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			transform 0.05s ease;
	}

	button:active {
		transform: translateY(1px);
	}

	.primary {
		background-color: #2563eb;
		color: white;
	}

	.primary:hover {
		background-color: #1d4ed8;
	}

	.speaking-indicator {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		margin: 10px 0;
		user-select: none;
	}

	.speaking-text {
		font-size: 0.95rem;
		opacity: 0.8;
	}

	.bars {
		display: inline-flex;
		align-items: flex-end;
		gap: 3px;
		height: 18px;
	}

	.bar {
		width: 3px;
		height: 6px;
		border-radius: 2px;
		background: currentColor;
		opacity: 0.6;
		animation: wave 900ms ease-in-out infinite;
	}

	.bar:nth-child(1) {
		animation-delay: 0ms;
	}
	.bar:nth-child(2) {
		animation-delay: 120ms;
	}
	.bar:nth-child(3) {
		animation-delay: 240ms;
	}
	.bar:nth-child(4) {
		animation-delay: 360ms;
	}
	.bar:nth-child(5) {
		animation-delay: 480ms;
	}

	@keyframes wave {
		0%,
		100% {
			height: 6px;
			opacity: 0.4;
		}
		50% {
			height: 18px;
			opacity: 0.9;
		}
	}

	.voice-actions {
		margin-top: 12px;
		display: flex;
		gap: 12px;
		align-items: center;
		flex-wrap: wrap;
	}

	.voice-status {
		margin: 0;
		opacity: 0.8;
	}

	.voice-error {
		margin: 0;
		opacity: 0.9;
	}

	.voice-fallback {
		margin-top: 12px;
		opacity: 0.8;
	}
	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.rec-indicator {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		border-radius: 999px;
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: rgba(255, 255, 255, 0.06);
	}

	.rec-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;

		/* ✅ Make it visible on light backgrounds */
		background: #ff3b3b;

		/* subtle glow so it never disappears */
		box-shadow: 0 0 6px rgba(255, 59, 59, 0.8);

		animation: recPulse 1.1s ease-in-out infinite;
	}

	.rec-text {
		font-size: 12px;
		letter-spacing: 0.08em;
		opacity: 0.9;
	}

	.rec-time {
		font-variant-numeric: tabular-nums;
		font-size: 12px;
		opacity: 0.8;
	}

	@keyframes recPulse {
		0%,
		100% {
			transform: scale(1);
			opacity: 0.55;
		}
		50% {
			transform: scale(1.35);
			opacity: 1;
		}
	}
</style>
