<script lang="ts">
    import { api } from "$lib/api";

    //----------------------------Reactive state bound to form inputs------------------------
    let candidateEmail = "";
    let role = "";
    let seniority: "intern" | "junior" | "intermediate" | "senior" | "lead" = "junior";
    let style: "balanced" | "behavioral" | "technical" = "balanced";

    let jobDescription = "";
    let pastedCV = "";
    let pastedCompanyInfo = "";
    let pastedAdditionalInfo = "";

    //----------------------------------- UI feedback --------------------------------
    let loading = false;
    let errorMsg = "";
    let successMsg = "";
    let interviewId: string | null = null;
    let chunksIndexed = 0;
    let sourcesCount = 0;

    function toBlocks(): string[] {
        //gather non-empty blocks
        return [pastedCV, pastedCompanyInfo, pastedAdditionalInfo].map(s => s.trim()).filter(Boolean);
    }

    async function handleSubmit() {
        errorMsg = ""
        successMsg = "";
        loading = true;
        interviewId = null;
        chunksIndexed = 0;
        sourcesCount = 0;

        try {
            // 1) Create the interview session first
            const startBody = {
                user_email: candidateEmail.trim(),
                role: role.trim(),
                seniority,
                style
            };

            //Basic client-side validation (helps users)
            if (!startBody.user_email) throw new Error("Please enter your email.");
            if (!startBody.role) throw new Error("Please provide a role (e.g., 'Android Developer').");

            const startResp = await api.post<{ interview_id: string; questions: unknown[] }>(
                "/interview/start",
                startBody
            );
            interviewId = startResp.interview_id;

            // 2) Ingest pasted texts (if any)
            const blocks = toBlocks();
            const ingestBody = {
                interview_id: interviewId,
                user_email: candidateEmail.trim(),
                pasted_texts: blocks,
                job_description: jobDescription.trim() || null
            };

            //Only call ingest if user provided *something* to ingest
            if(blocks.length > 0 || ingestBody.job_description){
                const ingestResp = await api.post<{ interview_id?: string, sources: number, chunks_indexed: number}>(
                    "/ingest/paste",
                    ingestBody
                );
                sourcesCount = ingestResp.sources ?? 0;
                chunksIndexed = ingestResp.chunks_indexed ?? 0;
            }

            // 3) Done - show a nice success message
            successMsg = `Interview created. ID: ${interviewId}. ${sourcesCount} source(s), ${chunksIndexed} chunk(s) indexed.`;

            // navigate the user to an interview page next

        } catch (err: any){
            console.error("Submit failed:", err);
            errorMsg = err?.message || "Something went wrong.";
        } finally {
            loading = false;
        }
    }
</script>

<!-- Simple intake form-->
 <div class="container">
    <h1>Mock Interview - Intake</h1>
    <p class="hint">
        Enter your info, past your CV / the company information / job description, then start your interview.
    </p>

    {#if errorMsg}
    <div class="error">{errorMsg}</div>
    {/if}
    {#if successMsg}
    <div class="success" style="white-space: pre-line;">{successMsg}</div>
    {/if}

    <form on:submit|preventDefault={handleSubmit}>
        <fieldset disabled={loading}>
            <label>
                Email
                <input type="email" placeholder="you@exemple.com" bind:value={candidateEmail} required />
            </label>
            <br />
            <div class="grid">
                <label>
                    Role
                    <input type="text" placeholder="Android Developer" bind:value={role} required />
                </label>

                <label>
                    Seniority
                    <select bind:value={seniority}>
                        <option value="intern">intern</option>
                        <option value="junior">junior</option>
                        <option value="intermediate">intermediate</option>
                        <option value="senior">senior</option>
                        <option value="lead">lead</option>
                    </select>
                </label>

                <label>
                    Style of interview
                    <select bind:value={style}>
                        <option value="balanced">balanced</option>
                        <option value="behavioral">behavioral</option>
                        <option value="technical">technical</option>
                    </select>
                </label>
            </div>
            <br />  
            <label>
                Job Description (optional)
                <textarea rows="5" placeholder="Paste the JD here..." bind:value={jobDescription}></textarea>
            </label>
            <br />
            <div class="grid">
                <label>
                    CV / Resume (paste)
                    <textarea rows="10" placeholder="Paste CV text..." bind:value={pastedCV}></textarea>
                </label>
                                <label>
                    Company information (optional)
                    <textarea rows="10" placeholder="Paste Company info text..." bind:value={pastedCompanyInfo}></textarea>
                </label>
                                <label>
                    Additional information (optional)
                    <textarea rows="10" placeholder="Paste Additional Info text..." bind:value={pastedAdditionalInfo}></textarea>
                </label>
            </div>
            <br />
            <button type="submit">{loading ? "Woriking..." : "Create interview and ingest texts"}</button>
        </fieldset>
    </form>

    {#if interviewId}
        <div class="box">
            <strong>Interview ID</strong><br />
            <code>{interviewId}</code>
            <p class="hint">Keep this around - the UI will use it for " next question", "answer", and "summary"</p>
        </div>    
    {/if}
 </div>

 <style>
    .container { max-width: 960px; margin: 2rem auto; padding: 1rem; }
    .grid {
        display: grid; gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    }
    form { display: grid; gap: 1rem; margin-top: 1rem; }
    label { display: grid; gap: 0.5rem; }
    input, select, textarea { padding: 0.6rem; font-size: 0.95rem; }
    button { padding: 0.8rem 1.2rem; font-weight: 600; }
    .hint { color: #666; }
    .error { background: #ffe8e8; border: 1px solid #ffb3b3; padding: 0.75rem; }
    .success { background: #e8ffe9; border: 1px solid #b3ffc0; padding: 0.75rem; }
    .box { border: 1px dashed #aaa; padding: 0.75rem; margin-top: 1rem; }
 </style>