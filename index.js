const express = require("express");

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
    res.send("PR Guardian is alive");
});
app.post("/webhook", (req, res) => {
    const event = req.headers["x-github-event"];

    console.log("Event:", event);

    if (event === "pull_request") {
        console.log(
            `PR #${req.body.pull_request.number} ${req.body.action} in repo ${req.body.repository.name}`
        );
    }

    res.status(200).send("Webhook processed");
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});