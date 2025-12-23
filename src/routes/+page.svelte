<script lang="ts">
    import { goto } from "$app/navigation";
    import { startInterview } from "$lib/api/interview";
    import type { InterviewStartRequest } from "$lib/api/types";

    let candidate_email = '';
    let role = '';
    let seniority: InterviewStartRequest['seniority'] = 'junior';
    let style: InterviewStartRequest['style'] = 'balanced';

    let loading = false;
    let error: string | null = null;

    async function onCreateInterview(event:SubmitEvent) {
        event.preventDefault();
        error = null;
        
        if (!candidate_email.trim()){
            error = 'Email is required.';
            return;
        }

        loading = true;
        try {
            const res = await startInterview({
                candidate_email: candidate_email.trim(),
                role: role.trim(),
                seniority,
                style
            });
            await goto(`/interview/${res.interview_id}/ingest`);
        } catch (e: any) {
            error = e?.message ?? 'Failed to create interview.';
        } finally {
            loading = false;
        }
    }
</script>

<h1>Interview Setup</h1>
<p>Create an interview session, then add context and generate questions.</p>

<form on:submit={onCreateInterview} style="display:grid; gap:12px; max-width:520px;">
    <label>
        Email:
        <input
            type="email"
            bind:value={candidate_email}
            placeholder="you@example.com"
            autocomplete="email"
            required
        />
    </label>

    <label>
        Role:
        <input
            type="text"
            bind:value={role}
            placeholder="Android Developer"
            required
        />
    </label>

    <label>
        Seniority:
        <select bind:value={seniority}>
            <option value="intern">intern</option>
            <option value="junior">junior</option>
            <option value="intermediate">intermediate</option>
            <option value="senior">senior</option>
            <option value="lead">lead</option>
        </select>
    </label>

    <label>
        Style:
        <select bind:value={style}>
            <option value="balanced">balanced</option>
            <option value="behavioral">behavioral</option>
            <option value="technical">technical</option>
        </select>
    </label>
    
    <div class="actions">
        <button class="primary" type="submit" disabled={loading}>
            {#if loading}
                Creating...
            {:else}
                Create interview
            {/if}
        </button>
    </div>

    {#if error}
        <p style="color:red;">{error}</p>
    {/if}
</form>

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