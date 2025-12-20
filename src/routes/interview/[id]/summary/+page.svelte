<script lang="ts">
    import { page } from '$app/state';

    const interviewId = page.params.id;

</script>

<h1>Final Summary</h1>
<p>Interview ID: {interviewId}</p>

<p>
    This page will show the final coaching report returned by
    <code>/interview/summary</code> (generated once, then saved).
</p>

<nav style="display:flex; gap:12px; margin-top:16px;">
    <a href={`/interview/${interviewId}`}>Back to Interview</a>
    <a href={`/interview/${interviewId}/results`}>Back to Results</a>
    <a href={`/interview/${interviewId}/ingest`}>Back to Ingest</a>
</nav>