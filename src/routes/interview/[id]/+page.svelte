<script lang="ts">
    import { page } from '$app/state'
    import { nextQuestion } from '$lib/api/interview';
    import type { NextQuestionResponse } from '$lib/api/types';

    const interviewIdParm = page.params.id;

    if (!interviewIdParm) {
        throw new Error('Interview ID is missing from route parameters.');
    }

    const interviewId: string = interviewIdParm;

    let loading = false;
    let error: string | null = null;
    let nextQ: NextQuestionResponse | null = null;

    async function loadNextQuestion() {
        error = null;
        loading = true;
        
        try {
            nextQ = await nextQuestion({interview_id: interviewId});
        } catch (e: any) {
            error = e?.message ?? "Failed to load the next question.";
            nextQ = null;
        } finally {
            loading = false;
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
    <p><strong>Type:</strong>{nextQ.type}</p>
    <p><strong>Question:</strong>{nextQ.question}</p>
{:else}
    <p>Nothing to display.</p>
{/if}