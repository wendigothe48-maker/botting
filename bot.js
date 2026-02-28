const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// Home route
app.get("/", (req, res) => {
    console.log("Hello");
    res.send("Hello");
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
