<script lang="ts">
    import { page } from '$app/state'
    import { goto } from '$app/navigation';
    import { nextQuestion, answerQuestion } from '$lib/api/interview';
    import type { NextQuestionResponse } from '$lib/api/types';
    import { onMount, onDestroy } from 'svelte';
    import { interviewer } from "$lib/voice/interviewer"
    import { browser } from '$app/environment';

    const interviewIdParm = page.params.id;

    if (!interviewIdParm) {
        throw new Error('Interview ID is missing from route parameters.');
    }

    const interviewId: string = interviewIdParm;

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
    let voiceRetryAvailable = false;
    let lastQuestionTextSpoken = '';

    function sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function loadNextQuestion(showLoading: boolean = true) {

        if (redirecting) return;

        error = null;
        loading = true;
        
        try {
            nextQ = await nextQuestion({interview_id: interviewId});

            if (nextQ.status === 'completed') {
                redirecting = true;
                completed = true;
                currentQuestion = null;
                totalQuestions = null;
                await sleep(5000);
                await goto(`/interview/${interviewId}/results`);
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

    async function onSubmitAnswer() {
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
                interview_id: interviewId,
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




    

    function retrySpeakQuestion(): void {
        if (!browser) return;
        const text = lastQuestionTextSpoken.trim();
        if (!text) return;

        interviewer.speak(text).then((result) => {
        if (result.ok) {
            keywordHintVisible = true;
            voiceRetryAvailable = false;
        }
        });
    }

    $: if (!browser) {
        // During SSR: always show text (voice cannot run server-side)
        questionTextVisible = true;
        keywordHintVisible = true;
    } else if (nextQ?.status !== 'in_progress') {
        // Leaving interview mode: reset guard so next in_progress can speak
        lastSpokenQuestionId = null;
    } else if (
        nextQ?.status === 'in_progress' &&
        nextQ.question_id &&
        nextQ.question_id !== lastSpokenQuestionId
    ) {
        // New question in browser: speak once
        lastSpokenQuestionId = nextQ.question_id;

        questionTextVisible = false;
        keywordHintVisible = false;
        voiceRetryAvailable = false;

        const textToSpeak = (nextQ.question ?? '').trim();
        lastQuestionTextSpoken = textToSpeak;
        console.log('[voice] question_id=', nextQ.question_id, 'len=', textToSpeak.length);

    if (!textToSpeak) {
        // Fallback: nothing to speak, reveal immediately
        console.log('[voice] fallback: empty text');
        questionTextVisible = true;
        keywordHintVisible = false;
    } else {
        interviewer.speak(textToSpeak).then((result) => {
            console.log('[voice] speak result=', result);
            if (result.ok) {
                // ✅ Voice succeeded → keywords only
                keywordHintVisible = true;
                // IMPORTANT: do NOT set questionTextVisible=true here
            } else if(result.reason === "not-allowed"){
                voiceRetryAvailable = true;
                questionTextVisible = false;
            } else {
                // ⚠️ Voice failed → text fallback
                questionTextVisible = true;
            }
        });
    }
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
<!-- {:else if nextQ?.status === 'completed'}
    <p>Interview completed. Redirecting you to the results page...</p> -->
{:else if nextQ?.status === 'in_progress'}
    <p><strong>Progress:</strong>Question {currentQuestion}/{totalQuestions}</p>
    <p><strong>Type:</strong>{nextQ.type}</p>

    {#if questionTextVisible}
        <p><strong>Question:</strong>{nextQ.question}</p>
    {/if}

    {#if keywordHintVisible && nextQ.keywords?.length}
        <p><strong>Keyword hint:</strong> {nextQ.keywords.join(', ')}</p>
    {/if}


    <textarea
        rows="8"
        placeholder="Type your answer here..."
        bind:value={answeredText}
        disabled={submitting}
        style="width:100%; max-width:800px;"
    ></textarea>

    <div class="actions">
        <button class="primary" on:click={onSubmitAnswer} disabled={submitting}>
            {#if submitting}
                Submitting your answer...
            {:else}
                Submit answer
            {/if}
        </button>

        {#if voiceRetryAvailable}
            <button type="button" class="secondary" on:click={retrySpeakQuestion}>
                Play question (audio)
            </button>
        {/if}

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
</style>