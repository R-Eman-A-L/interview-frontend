<script lang="ts">
    import { page } from '$app/state';

    const interviewId = page.params.id;

</script>

<h1>Ingest Context</h1>
<p>Interview ID: {interviewId}</p>

<p>
    This page will allow the usr to paste resume, notes, or job description
    before generating interview questions.
</p>

<nav style="margin-top:16px;">
    <a href="{`/interview/${interviewId}`}">Back to Interview</a>
</nav>