<script lang="ts">
    import { page } from '$app/state';
    import { onMount } from 'svelte';
    import { getInterviewResults } from '$lib/api/interview';
    import type { InterviewResultResponse } from '$lib/api/types';

    const interviewIdParam = page.params.id;

    if (!interviewIdParam) {
        throw new Error('Interview ID is missing from the route parameters.');
    }

    const interviewId: string = interviewIdParam;

    let loading = false;
    let error: string | null = null;
    let data: InterviewResultResponse | null = null;

    function formatLabel(label: string): string {
        const withSpaces = label.replaceAll('_', ' ');
        return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
    }

    function labelStyle(label: string): string {
        switch(label) {
            case 'failed': 
                return 'color:#b00020; font-weight:700;';
            case 'very_weak':
                return 'color:#d14900; font-weight:700;';
            case 'acceptable':
                return 'color:#b8860b; font-weight:700;';
            case 'good':
                return 'color:#2e7d32; font-weight:700;';
            case 'excellent':
                return 'color:#1b5e20; font-weight:700;';
            default:
                return 'font-weight:700;';
        }
    }

    async function loadResults() {
        error = null;
        loading = true;

        try {
            data = await getInterviewResults({interview_id: interviewId});
        } catch (e: any) {
            error = e?.message ?? 'Failed to load interview results.';
            data = null;
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        loadResults();
    });
</script>

<h1>Results</h1>
<p>Interview ID: {interviewId}</p>

{#if loading}
    <p>Loading results...</p>
{:else if error}
    <p style="color:red;">{error}</p>
{:else if data}
    <h2>Overview</h2>
    <p><strong>Status:</strong> {data.status}</p>
    <p><strong>Total question(s):</strong> {data.total_questions}</p>
    <p>
        <strong>Average score:</strong>
        {#if data.avg_score === null}
            N/A
        {:else}
            {Math.round((data.avg_score / 5) * 100)}%
            <span> (based on {data.answered_count}/{data.total_questions} graded questions)</span>  
        {/if}
    </p>
    
    <h2 style="margin-top:20px;">Per-question results</h2>

    {#if data.results.length === 0}
        <p>No results found.</p>
    {:else}
        {#each data.results as question (question.question_id)}
            <div style="border:1px solid #ddd; padding:12px; margin:12px 0; border-radius:8px">
                <p><strong>Question {question.index + 1}</strong> — {question.type}</p>
                <p>{question.question}</p>

                <p style="margin-top:10px;"><strong>Answer:</strong></p>
                <p>{question.answer_text ?? 'No answer submitted.'}</p>

                <p style="margin-top:10px;">
                    <strong>Score:</strong>
                    {#if question.numeric_score === null}
                        N/A
                    {:else}
                        {question.numeric_score}/5  
                    {/if}
                    {#if question.label}
                        — <span style={labelStyle(question.label)}>{formatLabel(question.label)}</span>
                    {/if}
                </p>
                
                {#if question.grading_status && question.grading_status !== 'graded'}
                    <p>
                        <strong>Grading status:</strong>
                        {question.grading_status === 'pending' ? 'Pending' : 'Failed'}
                    </p>                    
                {/if}

                {#if question.feedback}
                    <p style="margin-top: 10px;"><strong>Feedback:</strong></p>
                    <p> {question.feedback}</p>
                {/if}
            </div>
        {/each}
    {/if}
{:else}
   <p>Nothing to display.</p>
{/if}

<div style="margin-top:16px;">
    <a href={`/interview/${interviewId}/summary`}
    style="display:inline-block; padding:10px 14px; border-radius:8px; border:1px solid #ddd; text-decoration:none;">
    Continue to Summary
    </a>
</div>


