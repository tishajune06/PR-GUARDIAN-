require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const { Octokit } = require("octokit");
const { GoogleGenAI } = require("@google/genai");
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});
async function testGitHub() {
    try {
        const { data } = await octokit.request("GET /user");

        console.log("GitHub Connected ✅");
        console.log("Username:", data.login);
    } catch (error) {
        console.log("GitHub Connection Failed ❌");
        console.log(error.message);
    }
}

testGitHub();  
async function reviewWithGemini(diff) {

    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {

        try {

            const prompt = `
You are an expert software engineer performing a code review.

Review the following GitHub pull request diff.

Your job is to identify only REAL and meaningful issues.

Focus on:
- Bugs
- Incorrect logic
- Security vulnerabilities
- Performance problems
- Reliability problems

Do NOT report:
- Personal coding style preferences
- Formatting issues
- Naming preferences
- Minor refactoring suggestions
- Nitpicks

Return ONLY valid JSON.

Use exactly this structure:

{
  "issues": [
    {
      "severity": "low | medium | high | critical",
      "file": "filename",
      "message": "description of the issue",
      "suggestion": "how to fix it"
    }
  ],
  "suggestions": []
}

If there are no real issues, return:

{
  "issues": [],
  "suggestions": []
}

Here is the PR diff:

${diff}
`;

            console.log(`Sending review request to Gemini... Attempt ${attempt}/${maxRetries}`);

            const response = await ai.models.generateContent({
                model: "gemini-3.5-flash",
                contents: prompt
            });

            const reviewText = response.text;

            const cleanedText = reviewText
                .replace(/```json/g, "")
                .replace(/```/g, "")
                .trim();

            const review = JSON.parse(cleanedText);

            console.log("Gemini Review Successful ✅");

            return review;

        } catch (error) {

            console.log(`Gemini attempt ${attempt} failed ❌`);
            console.log(error.message);

            if (attempt < maxRetries) {

                const delay = attempt * 2000;

                console.log(`Retrying in ${delay / 1000} seconds...`);

                await new Promise(resolve => {
                    setTimeout(resolve, delay);
                });

            } else {

                console.log("Gemini failed after all retries ❌");

                return null;
            }
        }
    }
}

async function postReviewComment(owner, repo, pullNumber, review) {

    try {

        const comment = `
## 🤖 PR Guardian Review

${review}

---

*Review generated automatically by Gemini.*
`;

        await octokit.request(
            "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
            {
                owner: owner,
                repo: repo,
                issue_number: pullNumber,
                body: comment
            }
        );

        console.log("Review posted to GitHub PR ✅");

    } catch (error) {

        console.log("Failed to post review ❌");
        console.log(error.message);

    }
}
async function getPullRequestFiles(owner, repo, pullNumber) {
    try {
        const { data } = await octokit.request(
            "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
            {
                owner: owner,
                repo: repo,
                pull_number: pullNumber
            }
        );

        const allowedExtensions = [
            ".js",
            ".jsx",
            ".ts",
            ".tsx",
            ".py",
            ".java",
            ".cpp",
            ".c",
            ".cs",
            ".go"
        ];

        const filteredFiles = data.filter(file => {
            return allowedExtensions.some(extension =>
                file.filename.endsWith(extension)
            );
        });

       const reviewFiles = filteredFiles.map(file => ({
    filename: file.filename,
    status: file.status,
    patch: file.patch
}));

console.log("Review Files:");

reviewFiles.forEach(file => {
    console.log("--------------------");
    console.log("File:", file.filename);
    console.log("Status:", file.status);
    console.log("Patch:");
    console.log(file.patch || "No patch available");
});
const diff = reviewFiles
    .map(file => {
        return `
File: ${file.filename}
Status: ${file.status}

${file.patch || "No patch available"}
`;
    })
    .join("\n");
   const review = await reviewWithGemini(diff);

console.log("AI Review:");

if (review) {

    console.log(JSON.stringify(review, null, 2));

    await postReviewComment(
        owner,
        repo,
        pullNumber,
        JSON.stringify(review, null, 2)
    );
}

    } catch (error) {
        console.log("Failed to fetch PR files ❌");
        console.log(error.message);
    }
}

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

console.log("Webhook secret loaded:", !!WEBHOOK_SECRET);


// Temporary HMAC test
const testBody = "hello";

const signature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(testBody)
    .digest("hex");

console.log("Generated signature:", signature);



const app = express();

app.use(
    express.json({
        verify: (req, res, buf) => {
            req.rawBody = buf;
        }
    })
);
function verifyGitHubSignature(req, res, next) {

    console.log("Inside Signature Middleware");

    const signature = req.headers["x-hub-signature-256"];

    if (!signature) {
        return res.status(403).send("Missing GitHub Signature");
    }

    const expectedSignature =
        "sha256=" +
        crypto
            .createHmac("sha256", WEBHOOK_SECRET)
            .update(req.rawBody)
            .digest("hex");

    const signatureBuffer = Buffer.from(signature);
    const expectedSignatureBuffer = Buffer.from(expectedSignature);

    // 👇 YEH NAYA CODE YAHAN ADD KARNA HAI
    if (signatureBuffer.length !== expectedSignatureBuffer.length) {
        return res.status(403).send("Invalid Signature");
    }

    // Ab dono buffers ki length same hai,
    // isliye timingSafeEqual safely call kar sakte hain.
    if (
        !crypto.timingSafeEqual(
            signatureBuffer,
            expectedSignatureBuffer
        )
    ) {
        return res.status(403).send("Invalid Signature");
    }

    console.log("Signature Verified ✅");

    next();
}
app.post("/test", (req,res)=>{

    console.log("RAW:");
    console.log(req.rawBody.toString());

    console.log("JSON:");
    console.log(req.body);

    res.send("ok");
});

app.get("/", (req, res) => {
    res.send("PR Guardian is alive");
});
console.log("Webhook automatic test");

app.post("/webhook", verifyGitHubSignature, async (req, res) => {

    const event = req.headers["x-github-event"];

    console.log("Event:", event);

    res.status(200).send("Webhook received");

    if (event === "pull_request") {

        const owner = req.body.repository.owner.login;
        const repo = req.body.repository.name;
        const pullNumber = req.body.pull_request.number;

        console.log(
            `PR #${pullNumber} ${req.body.action} in repo ${owner}/${repo}`
        );

        await getPullRequestFiles(owner, repo, pullNumber);
    }
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});
console.log("PR Guardian Phase 5 test");
