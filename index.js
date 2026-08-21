const express = require("express");

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
    res.send("PR Guardian is alive");
});
app.post("/webhook", (req, res) => {

    console.log("Event:", req.headers['x-github-event']);

    console.log("Action:", req.body.action);

    console.log("PR Number:", req.body.pull_request.number);

    console.log("Repository:", req.body.repository.name);
    console.log(
    "User:",
    req.body.pull_request?.user?.login
); 

    res.send("processed");
});
console.log("Testing PR Guardian");
app.listen(3000, () => {
    console.log("Server running on port 3000");
});
