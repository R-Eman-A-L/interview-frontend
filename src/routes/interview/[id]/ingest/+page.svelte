<script lang="ts">
	import { goto } from '$app/navigation';
    import { page } from '$app/state';
	import { ingestPaste } from '$lib/api/ingest';
	import { generateQuestions } from '$lib/api/interview';

    const interviewIdParam  = page.params.id;
    
    if (!interviewIdParam ) {
        throw new Error('Interivew ID is missing from route parameters.');
    }

    const interviewId: string = interviewIdParam

    let contextText = '';
    let jobDescriptionText = '';
    let loading = false;
    let error: string | null = null;

    async function onGenerateQuestions() {
        error = null;
        loading = true;

        try {
        const trimmedContextText = contextText.trim();
        const trimmedJobDescriptionText = jobDescriptionText.trim();
        const pasted_texts = [trimmedContextText].filter((t) => t.length > 0);

        if (pasted_texts.length > 0 || trimmedJobDescriptionText.length > 0) {
            await ingestPaste({
            interview_id: interviewId,
            pasted_texts,
            ...(trimmedJobDescriptionText.length > 0
                ? { job_description: trimmedJobDescriptionText }
                : {})
            });
        }

            await generateQuestions({
                interview_id: interviewId
            })

            await goto(`/interview/${interviewId}`);
        } catch (e: any) {
            error = e?.message ?? 'Failed to prepare interview.';
        } finally {
            loading = false;
        }
    }
</script>

<h1>Add Context</h1>
<p>Interview ID: {interviewId}</p>

<p>
    Paste your resume, notes, company extra informations, or the job description below.
    If you decide to leave this field empty, the questions will be generated using your setup informations only.
</p>

<textarea
    rows="10"
    placeholder="Paste your C.V / company info / extra notes  here (optinal)"
    bind:value={contextText}
    style="width:100%; max-width:800px;"
></textarea>

<textarea
    rows="10"
    placeholder="Paste the job description here (optinal)"
    bind:value={jobDescriptionText}
    style="width:100%; max-width:800px;"
></textarea>

<div class="actions">
    <button class="primary"  on:click={onGenerateQuestions} disabled={loading}>
        {#if loading}
            Preparing interview...
        {:else}
            Generate questions
        {/if}
    </button>
</div>

{#if error}
    <p style="color:red; margin-top:12px;">{error}</p>
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