<script lang="ts">
    import { page } from '$app/state'
    import { nextQuestion, answerQuestion } from '$lib/api/interview';
    import type { NextQuestionResponse } from '$lib/api/types';

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

    async function loadNextQuestion() {
        error = null;
        loading = true;
        
        try {
            nextQ = await nextQuestion({interview_id: interviewId});
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
            await loadNextQuestion();
        } catch (e: any) {
            error = e?.message ?? 'Failed to submit the answer.';
        } finally{
            submitting = false;
        }
        
    }

    // make the function call immediately when the page is created.
    void loadNextQuestion();

</script>

<h1>Interview</h1>
<p>Interview ID: {interviewId}</p>

{#if loading}
    <p>Loading next question...</p>
{:else if error}
    <p style="color:red;">{error}</p>
{:else if nextQ?.status === 'completed'}
    <p>No more questions.</p>
{:else if nextQ?.status === 'in_progress'}
    <p><strong>Progress:</strong>Question {currentQuestion}/{totalQuestions}</p>
    
    <p><strong>Type:</strong>{nextQ.type}</p>
    <p><strong>Question:</strong>{nextQ.question}</p>

    <textarea
        rows="8"
        placeholder="Type your answer here..."
        bind:value={answeredText}
        disabled={submitting}
        style="width:100%; max-width:800px;"
    ></textarea>

    <div style="margin-top:16px;">
        <button on:click={onSubmitAnswer} disabled={submitting}>
            {#if submitting}
                Submitting your answer...
            {:else}
                Submit answer
            {/if}
        </button>
    </div>
{:else}
    <p>Nothing to display.</p>
{/if}