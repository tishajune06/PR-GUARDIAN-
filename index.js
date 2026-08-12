const express = require("express");

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
    res.send("PR Guardian is alive");
});
app.post("/webhook", (req, res) => {

    console.log("nt:", req.headers['x-github-event']);

    console.log("An:", req.body.action);

    console.log("PR Numr:", req.body.pull_request.number);

    console.log("Repository:", req.body.repository.name);
    console.log(
    "User:",
    req.body.pull_request?.user?.login
); 

    res.send("Webhook processed");
});
console.log("File filtering test");
app.listen(3000, () => {
    console.log("Server running on port 3000");
});
