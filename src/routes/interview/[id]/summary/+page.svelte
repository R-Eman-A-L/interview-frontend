<script lang="ts">
    import { page } from '$app/state';
	import { getInterviewSummary } from '$lib/api/interview';
    import {onMount } from 'svelte';
    import type { InterviewSummaryResponse } from '$lib/api/types';
	import { goto } from '$app/navigation';

    const interviewIdParam = page.params.id;

    if(!interviewIdParam){
        throw new Error('The interview ID is missing from the route parameters.')
    }
    const interviewId = interviewIdParam;

    let loading = false;
    let error: string | null = null;
    let summary: InterviewSummaryResponse | null = null; 

    async function loadSummary() {

        loading = true;

        try {
            summary = await getInterviewSummary({interview_id: interviewId});
        } catch (e: any) {
            error = e?.message ?? 'Failed to load summary.';
        } finally {
            loading = false;
        }   
    }

    function gotoResults() {
        void goto(`/interview/${interviewId}/results`);
    }

        function gotoInterview() {
        void goto(`/`);
    }

    function normalizeSummaryText(text: string): string {
        return text
        // normalize all unicode whitespace (including NBSP) to regular spaces
        .replace(/\u00A0/g, ' ')
        // remove markdown headings like ###
        .replace(/^#{1,6}\s*/gm, '')
        // remove bold markers **text**
        .replace(/\*\*(.*?)\*\*/g, '$1')
        // remove indentation at start of line
        .replace(/^[ \t]+/gm, '')
        // collapse excessive blank lines
        .replace(/\n{3,}/g, '\n\n')
        // promote numbered section titles (e.g. "1) Title")
        .replace(
            /^(\d+\)\s+.+)$/gm,
            '<strong style="display:block; margin-top:16px;">$1</strong>'
        )
        // final trim
        .trim();
    }


    onMount(() => {
        loadSummary()
    })

</script>

<h1>Final Summary</h1>
<p>Interview ID: {interviewId}</p>

{#if loading}
    <p>Loading summary...</p>
{:else if error}
    <p style="color:red;">{error}</p>
{:else if summary}
    <div style="margin-top:16px;">      
        <h2 style="margin-top:16px;">Coaching Summary</h2>
        <p>
            <strong>Average score:</strong>
            {#if summary.avg_score === null}
                N/A
            {:else}
                {Math.round((summary.avg_score / 5) * 100)}%
            {/if}
        </p> 
        
        <pre style="white-space:pre-wrap; margin-top:8px; max-width:900px;">{@html normalizeSummaryText(summary.summary_text)}</pre>
    </div>
{:else}
    <p>No summary available.</p>
{/if} 

<div class="actions">
    <button class="primary" on:click={gotoInterview}>
        Try again
    </button>
    <button class="secondary" on:click={gotoResults}>
        Back to Results
    </button>
</div>

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

    .secondary {
        background-color: #e5e7eb;
        color: #111827;
    }

    .secondary:hover {
        background-color: #d1d5db;
    }
</style>