require("dotenv").config();
const config = require("./config.json");
const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const User = require("./models/user.model");
const Note = require("./models/note.model");
const {authenticateToken} = require("./utilities")

// Connect to MongoDB
mongoose.connect(config.connectionString)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.error("MongoDB connection error:", err));

const app = express();

// Middleware
app.use(express.json()); // This includes body parser
app.use(cors({ origin: "*" }));

// Test route
app.get('/', (req, res) => {
    res.json({ data: "hello" });
});

// Backend Ready!!!

// Create Account 
app.post("/create-account", async (req, res) => {
    const { fullName, email, password } = req.body;

    if (!fullName) {
        return res.status(400).json({ error: true, message: "Full Name is required" });
    }

    if (!email) {
        return res.status(400).json({ error: true, message: "Email is required" });
    }

    if (!password) {
        return res.status(400).json({ error: true, message: "Password is required" });
    }

    try {
        const isUser = await User.findOne({ email: email });
        if (isUser) {
            return res.status(400).json({ error: true, message: "User already exists" });
        }

        const user = new User({ fullName, email, password });
        await user.save();

        const accessToken = jwt.sign({ user }, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: "36000m",
        });

        return res.json({
            error: false,
            user,
            accessToken,
            message: "Registration Successful",
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: true, message: "Internal Server Error" });
    }
});

// Create Login
app.post("/login", async (req, res) =>{
    const {email, password} = req.body;

    if(!email){
        return res.status(400).json({message: "Email is required"});
    }

    if (!password){
        return res.status(400).json({message: "Password is required"});
    }

    const userInfo = await User.findOne({email: email});

    if (!userInfo){
        return res.status(400).json({message: "User not foung"});
    }

    if (userInfo.email == email && userInfo.password == password){
        const user = {user: userInfo};
        const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET,{
            expiresIn: "36000m",
        });

        return res.json({
            error: false,
            message: "Login Successful",
            email,
            accessToken,
        });
    }else{
        return res.status(400).json({
            error: true,
            message: "Invalid Credentials"
        });
    }
});

// Get User 
app.get("/get-user",authenticateToken, async (req, res) =>{
    const {user} = req.user;

    const isUser = await User.findOne({_id: user._id});

    if (!isUser){
        return res.sendStatus(401);
    }

    return res.json({
        user: {fullName: isUser.fullName, email: isUser.email, "_id": isUser._id, createdOn: isUser.createdOn},
        message: "",
    });
});

//Add Note 
app.post("/add-note", authenticateToken, async (req, res) => {
    const { title, content, tags } = req.body;
    const { user } = req.user;

    if (!title) {
        return res.status(400).json({ error: true, message: "Title is required" });
    }

    if (!content) {
        return res.status(400).json({ error: true, message: "Content is required" });
    }

    // Debugging: Log req.user and tags
    console.log("req.user:", req.user);
    console.log("tags:", tags);

    if (!user || !user._id) {
        return res.status(400).json({ error: true, message: "User not found" });
    }

    try {
        const note = new Note({
            title,
            content,
            tags: tags || [], // Corrected this line
            userId: user._id,
        });

        await note.save();

        return res.json({
            error: false,
            note,
            message: "Note added successfully",
        });
    } catch (error) {
        console.error("Error saving note:", error); // Log the error for debugging
        return res.status(500).json({
            error: true,
            message: "Internal Server Error",
        });
    }
});

//Edit Note
app.put("/edit-note/:noteId", authenticateToken, async (req, res) => {
    const noteId = req.params.noteId;
    const { title, content, tags, isPinned } = req.body;
    const { user } = req.user;

    if (!title && !content && !tags && typeof isPinned === 'undefined') {
        return res.status(400).json({ error: true, message: "No changes provided" });
    }

    try {
        const note = await Note.findOne({ _id: noteId, userId: user._id });

        if (!note) {
            return res.status(404).json({ error: true, message: "Note not found" });
        }

        // Update only provided fields
        if (title) note.title = title;
        if (content) note.content = content;
        if (tags) note.tags = tags;
        if (typeof isPinned !== 'undefined') note.isPinned = isPinned;

        await note.save();

        return res.json({
            error: false,
            note,
            message: "Note updated successfully",
        });
    } catch (error) {
        console.error("Error updating note:", error); // Log the error for debugging
        return res.status(500).json({
            error: true,
            message: "Internal Server Error",
        });
    }
});

// Get All Notes
app.get("/get-all-notes", authenticateToken, async (req, res) => {
    const { user } = req.user;

    try {
        const notes = await Note.find({ userId: user._id }).sort({ isPinned: -1 });

        return res.json({
            error: false,
            notes,
            message: "All notes retrieved successfully",
        });
    } catch (error) {
        console.error("Error retrieving notes:", error); // Log the error for debugging
        return res.status(500).json({
            error: true,
            message: "Internal Server Error",
        });
    }
});

// Delete Note
app.delete("/delete-note/:noteId", authenticateToken, async (req, res) => {
    const noteId = req.params.noteId;
    const { user } = req.user;

    try {
        const note = await Note.findOne({ _id: noteId, userId: user._id });

        if (!note) {
            return res.status(404).json({ error: true, message: "Note not found" });
        }

        await Note.deleteOne({ _id: noteId, userId: user._id });

        return res.json({
            error: false,
            message: "Note deleted successfully",
        });

    } catch (error) {
        console.error("Error deleting note:", error); // Log the error for debugging
        return res.status(500).json({
            error: true,
            message: "Internal Server Error",
        });
    }
});

// update IsPinned value 
app.put("/update-note-pinned/:noteId", authenticateToken, async (req, res) => {
    const noteId = req.params.noteId;
    const { isPinned } = req.body;
    const { user } = req.user;

    try {
        const note = await Note.findOne({ _id: noteId, userId: user._id });

        if (!note) {
            return res.status(404).json({ error: true, message: "Note not found" });
        }

        // Update only if isPinned is provided
        if (typeof isPinned !== 'undefined') {
            note.isPinned = isPinned;
        }

        await note.save();

        return res.json({
            error: false,
            note,
            message: "Note updated successfully",
        });
    } catch (error) {
        console.error("Error updating note:", error); // Log the error for debugging
        return res.status(500).json({
            error: true,
            message: "Internal Server Error",
        });
    }
});

// Search Notes 
app.get("/search-notes", authenticateToken, async (req, res) => {
    const { user } = req.user;
    const { query } = req.query;

    if (!query) {
        return res.status(400).json({ error: true, message: "Search query required" });
    }

    try {
        const matchingNotes = await Note.find({
            userId: user._id,
            $or: [
                { title: { $regex: new RegExp(query, "i") } },
                { content: { $regex: new RegExp(query, "i") } },
            ],
        });

        return res.status(200).json({ error: false, notes: matchingNotes, message: "Notes matching the search query retrieved successfully" });
    } catch (error) {
        console.error("Error searching notes:", error);
        return res.status(500).json({ error: true, message: "Internal Server Error" });
    }
});

// Start the server
app.listen(8000, () => {
    console.log("Server is running on port 8000");
});

module.exports = app;