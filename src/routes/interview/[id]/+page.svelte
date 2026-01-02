<script lang="ts">
    import { page } from '$app/state'
    import { goto } from '$app/navigation';
    import { nextQuestion, answerQuestion } from '$lib/api/interview';
    import type { NextQuestionResponse } from '$lib/api/types';
    import { onMount, onDestroy } from 'svelte';
    import { interviewer } from "$lib/voice/interviewer"
    import { browser } from '$app/environment';
	
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


    function sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function loadNextQuestion(): Promise<void> {

        if (redirecting) return;

        error = null;
        loading = true;
        
        try {
            nextQ = await nextQuestion({interview_id: INTERVIEW_ID});

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
            error = e?.message ?? "Failed to load the next question.";
            nextQ = null;
        } finally {
            loading = false;
        }
    }

    async function onSubmitAnswer(): Promise<void> {
        if( !nextQ || nextQ.status !== 'in_progress') return;

        const questionId = nextQ.question_id;

        if (!questionId) {
            error = 'The question ID is missing.';
            return;
        }
    
        const trimmedAnswered = answeredText.trim();
        if(trimmedAnswered.length === 0) {
            error = 'Answer cannot be empty.'
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
        } finally{
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
                    keywordHintVisible = true;   // show hint so they can proceed
                    questionTextVisible = false; // keep voice-first feel
                }
                return;
            }

            // Other failure => text fallback
            questionTextVisible = true;
            keywordHintVisible = false;
        });
    }

    function repeatStorageKey( interviewId: string, questionId: string): string {
        return `repeatCount:${interviewId}:${questionId}`;
    }

    function loadRepeatCountFromSession(interviewId: string, questionId: string): number {
        if(!browser) return 0;
        const raw = sessionStorage.getItem(repeatStorageKey(interviewId, questionId));
        const n = raw ? Number(raw) : 0;
        return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
    }

    function saveRepeatCountToSession(interviewId: string, questionId: string, count: number): void {
        if(!browser) return;
        sessionStorage.setItem(repeatStorageKey(interviewId, questionId), String(count));
    }

    function repeatQuestion(): void {
        if(isInterviewerSpeaking) return;
        if(repeatCountForCurrentQuestion >= MAX_REPEATS_PER_QUESTION) return;

        const questionId = nextQ?.question_id;
        const questionText = nextQ?.question ?? '';
        if(!questionId) return;

        const nextCount = repeatCountForCurrentQuestion + 1;
        repeatCountForCurrentQuestion = nextCount;
        saveRepeatCountToSession(INTERVIEW_ID, questionId, nextCount);

        speakQuestionOrFallback(questionId, questionText);
    }

    $: if (browser && nextQ?.status === 'in_progress' && nextQ.question_id && nextQ.question_id !== lastSpokenQuestionId) {
        const newQuestionId = nextQ.question_id;

        repeatCountForCurrentQuestion = loadRepeatCountFromSession(INTERVIEW_ID, newQuestionId);

        lastSpokenQuestionId = newQuestionId;

        speakQuestionOrFallback(newQuestionId, nextQ.question ?? '');
    }

    onDestroy(() =>{
        interviewer.cancel();
    })

    // make the function call immediately when the page is created.
    onMount(() =>{
        loadNextQuestion();
        lastSpokenQuestionId = null;
    })
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

    <div class="actions">
        <button class="primary" on:click={onSubmitAnswer} disabled={submitting || isInterviewerSpeaking}>
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
        disabled={isInterviewerSpeaking || repeatCountForCurrentQuestion >= MAX_REPEATS_PER_QUESTION}>
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
        transition: background-color 0.15s ease, transform 0.05s ease;
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

  .bar:nth-child(1) { animation-delay: 0ms; }
  .bar:nth-child(2) { animation-delay: 120ms; }
  .bar:nth-child(3) { animation-delay: 240ms; }
  .bar:nth-child(4) { animation-delay: 360ms; }
  .bar:nth-child(5) { animation-delay: 480ms; }

  @keyframes wave {
    0%, 100% { height: 6px; opacity: 0.4; }
    50% { height: 18px; opacity: 0.9; }
  }
</style>