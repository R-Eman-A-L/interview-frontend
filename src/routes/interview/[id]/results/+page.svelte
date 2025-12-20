<script lang="ts">
    import { page } from '$app/state';

    const interviewId = page.params.id;

</script>

<h1>Results</h1>
<p>Interview ID: {interviewId}</p>

<p>
    This page will show the detailed per-question results (score + feedback),
    pulled from <code>/interview/results</code>.
</p>

<nav style="display:flex; gap:12px; margin-top:16px;">
    <a href={`/interview/${interviewId}`}>Back to Interview</a>
    <a href={`/interview/${interviewId}/summary`}>Go to Summary</a>
</nav>