const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const pdfParse = require('pdf-parse');
const nlpEngine = require('./nlp_engine');

const app = express();

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize SQLite Database
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error('Error connecting to SQLite:', err.message);
    else console.log('Connected to SQLite Database.');
});

// Database Schema & CSV Seeding Initialization
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        password TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic TEXT,
        question TEXT,
        option_a TEXT,
        option_b TEXT,
        option_c TEXT,
        option_d TEXT,
        correct_option TEXT,
        explanation TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS quiz_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        topic TEXT,
        score INTEGER,
        total INTEGER,
        percentage REAL,
        date TEXT
    )`);

    // Populate Questions from CSV if Database is Empty
    db.get("SELECT COUNT(*) as count FROM questions", [], (err, row) => {
        if (err) return console.error("Error reading database:", err.message);

        if (row && row.count === 0) {
            console.log("Database is empty. Populating 4,000 question bank from CSV...");
            
            const csvPath = path.join(__dirname, 'intelliquiz_4000_questions.csv');
            
            if (!fs.existsSync(csvPath)) {
                console.error(`Error: Could not find ${csvPath}. Make sure 'intelliquiz_4000_questions.csv' is in your project root folder.`);
                return;
            }

            const rowsToInsert = [];

            fs.createReadStream(csvPath)
                .pipe(csv())
                .on('data', (data) => rowsToInsert.push(data))
                .on('end', () => {
                    db.serialize(() => {
                        db.run("BEGIN TRANSACTION");
                        
                        const stmt = db.prepare(`
                            INSERT INTO questions (topic, question, option_a, option_b, option_c, option_d, correct_option, explanation) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        `);

                        rowsToInsert.forEach((r) => {
                            const cleanQ = (r.question || '').replace(/^Item\s*#\d+:\s*/i, '').trim();
                            const cleanExp = (r.explanation || '').replace(/^Item\s*#\d+:\s*/i, '').trim();
                            stmt.run(r.topic, cleanQ, r.option_a, r.option_b, r.option_c, r.option_d, r.correct_option, cleanExp);
                        });

                        stmt.finalize();

                        db.run("COMMIT", (err) => {
                            if (err) console.error("Error committing transaction:", err.message);
                            else console.log(`Successfully imported ${rowsToInsert.length} questions into database.db!`);
                        });
                    });
                });
        } else {
            console.log(`Database ready with ${row.count} questions.`);
        }
    });
});

// --- API ENDPOINTS ---

// 1. User Registration
app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "All fields are required." });
    
    const hash = bcrypt.hashSync(password, 8);

    db.run(`INSERT INTO users (name, email, password) VALUES (?, ?, ?)`, [name, email, hash], function(err) {
        if (err) return res.status(400).json({ error: "Email already registered." });
        res.json({ message: "Registration successful!", userId: this.lastID });
    });
});

// 2. User Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: "Invalid email or password." });
        }
        res.json({ message: "Login successful", user: { id: user.id, name: user.name, email: user.email } });
    });
});

// 3. Password Reset
app.post('/api/reset-password', (req, res) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
        return res.status(400).json({ error: "Email and new password are required." });
    }

    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: "Account with this email does not exist." });
        }

        const hash = bcrypt.hashSync(newPassword, 8);
        db.run(`UPDATE users SET password = ? WHERE email = ?`, [hash, email], function(err) {
            if (err) return res.status(500).json({ error: "Failed to update password." });
            res.json({ message: "Password updated successfully! Please log in with your new credentials." });
        });
    });
});

// 5. Quiz Mode: AI Document & Text Generator (NLP, TF-IDF, Cosine Similarity)
app.post('/api/generate/text', upload.single('file'), async (req, res) => {
    try {
        let extractedText = req.body.text || "";
        const numQuestions = parseInt(req.body.numQuestions) || 5;
        const difficulty = req.body.difficulty || 'medium';
        const aiMode = req.body.aiMode || 'tfidf_nlp'; // 'tfidf_nlp' | 'semantic_search' | 'hybrid'
        const domainHint = req.body.domainHint || 'general';

        // Read and parse PDF or text file if user uploaded a document
        if (req.file) {
            const filePath = req.file.path;
            try {
                if (req.file.mimetype === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf')) {
                    const pdfBuffer = fs.readFileSync(filePath);
                    const pdfData = await pdfParse(pdfBuffer);
                    extractedText += "\n" + (pdfData.text || "");
                } else {
                    // Fallback for plain text, markdown, or doc files (.txt, .md, .doc)
                    extractedText += "\n" + fs.readFileSync(filePath, 'utf8');
                }
            } finally {
                // Ensure temp file is always cleaned up
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        }

        extractedText = extractedText.trim();
        if (!extractedText || extractedText.length < 35) {
            return res.status(400).json({ 
                error: "Please upload a valid document or paste sufficient text content (at least 2-3 technical sentences) to generate questions." 
            });
        }

        if (aiMode === 'semantic_search') {
            // Retrieve semantically matching questions from database bank using Cosine Similarity
            db.all(`SELECT * FROM questions`, [], (err, rows) => {
                if (err || !rows || rows.length === 0) {
                    return res.status(500).json({ error: "Failed to access question bank for semantic matching." });
                }

                const matchedQuestions = nlpEngine.searchQuestionsByCosineSimilarity(extractedText, rows, numQuestions);
                const sentences = nlpEngine.tokenizeSentences(nlpEngine.cleanTechnicalText(extractedText));
                const { topKeywords } = nlpEngine.computeTfIdf(sentences);
                const docMetrics = nlpEngine.calculateDocumentMetrics(extractedText, sentences);

                return res.json({
                    topic: "Semantic Vector Search (VSM)",
                    count: matchedQuestions.length,
                    questions: matchedQuestions,
                    nlpMetadata: {
                        algorithm: "Vector Space Model (VSM) & Cosine Similarity Match against 4,000 Questions",
                        topKeywords: topKeywords.slice(0, 8),
                        wordCount: docMetrics.wordCount,
                        readingEase: docMetrics.readingEase,
                        difficulty: docMetrics.difficulty
                    }
                });
            });
        } else if (aiMode === 'hybrid') {
            // Half generated from text via TF-IDF + half matched from database bank
            const halfCount = Math.max(2, Math.ceil(numQuestions / 2));
            const nlpResult = nlpEngine.generateAIQuizFromText(extractedText, {
                numQuestions: halfCount,
                difficulty,
                domainHint
            });

            db.all(`SELECT * FROM questions`, [], (err, rows) => {
                let hybridQuestions = [...nlpResult.questions];
                if (!err && rows && rows.length > 0) {
                    const remainingNeeded = numQuestions - hybridQuestions.length;
                    if (remainingNeeded > 0) {
                        const matched = nlpEngine.searchQuestionsByCosineSimilarity(extractedText, rows, remainingNeeded);
                        matched.forEach((q, idx) => {
                            q.id = hybridQuestions.length + 1;
                            hybridQuestions.push(q);
                        });
                    }
                }

                return res.json({
                    topic: "Hybrid AI Assessment (TF-IDF + VSM)",
                    count: hybridQuestions.length,
                    questions: hybridQuestions,
                    nlpMetadata: {
                        algorithm: "Hybrid AI Pipeline: TF-IDF Extraction + Cosine Similarity Vector Matching",
                        topKeywords: nlpResult.nlpMetadata.topKeywords,
                        wordCount: nlpResult.nlpMetadata.wordCount,
                        readingEase: nlpResult.nlpMetadata.readingEase,
                        difficulty: nlpResult.nlpMetadata.difficulty
                    }
                });
            });
        } else {
            // Default: Pure AI Generation from text using NLP and TF-IDF
            const quizResult = nlpEngine.generateAIQuizFromText(extractedText, {
                numQuestions,
                difficulty,
                domainHint
            });

            // If text was short and fewer than requested questions were formed, top up with semantic match
            if (quizResult.questions.length < numQuestions) {
                db.all(`SELECT * FROM questions`, [], (err, rows) => {
                    if (!err && rows && rows.length > 0) {
                        const needed = numQuestions - quizResult.questions.length;
                        const topUp = nlpEngine.searchQuestionsByCosineSimilarity(extractedText, rows, needed);
                        topUp.forEach(q => {
                            q.id = quizResult.questions.length + 1;
                            quizResult.questions.push(q);
                        });
                    }
                    quizResult.count = quizResult.questions.length;
                    return res.json(quizResult);
                });
            } else {
                return res.json(quizResult);
            }
        }

    } catch (err) {
        console.error("AI Generation Error:", err);
        res.status(500).json({ error: "AI Generation Error: " + err.message });
    }
});

// 6. Quiz Mode: Fetch Predefined Subject Questions from Database Bank
app.get('/api/generate/predefined', (req, res) => {
    const topic = req.query.topic || 'DSA';
    const subtopic = (req.query.subtopic || 'all').trim();
    const count = parseInt(req.query.count) || 5;
    const difficulty = req.query.difficulty || 'medium';

    function formatQuestions(rows) {
        return rows.map((r, i) => ({
            id: i + 1,
            question: (r.question || '').replace(/^Item\s*#\d+:\s*/i, '').trim(),
            options: { A: r.option_a, B: r.option_b, C: r.option_c, D: r.option_d },
            correct: r.correct_option,
            explanation: (r.explanation || '').replace(/^Item\s*#\d+:\s*/i, '').trim(),
            difficulty: difficulty
        }));
    }

    if (subtopic && subtopic.toLowerCase() !== 'all') {
        // Extract meaningful keywords from subtopic string (e.g. "Arrays & Strings" -> ["Arrays", "Strings"])
        const keywords = subtopic
            .split(/[\s&/(),-]+/)
            .filter(w => w.length >= 3 && !['all', 'and', 'the', 'for'].includes(w.toLowerCase()));

        if (keywords.length > 0) {
            const clauses = keywords.map(() => `(question LIKE ? OR explanation LIKE ?)`).join(' OR ');
            const params = [topic];
            keywords.forEach(kw => {
                params.push(`%${kw}%`, `%${kw}%`);
            });
            params.push(count);

            const sql = `SELECT * FROM questions WHERE topic = ? AND (${clauses}) ORDER BY RANDOM() LIMIT ?`;
            
            db.all(sql, params, (err, rows) => {
                if (!err && rows && rows.length >= count) {
                    return res.json({ topic, count: rows.length, questions: formatQuestions(rows) });
                }

                // If fewer questions matched the specific subtopic keywords, supplement with random questions from the topic
                const matchedIds = (rows || []).map(r => r.id);
                const needed = count - matchedIds.length;

                let fallbackSql = `SELECT * FROM questions WHERE topic = ?`;
                const fallbackParams = [topic];

                if (matchedIds.length > 0) {
                    fallbackSql += ` AND id NOT IN (${matchedIds.map(() => '?').join(',')})`;
                    fallbackParams.push(...matchedIds);
                }
                fallbackSql += ` ORDER BY RANDOM() LIMIT ?`;
                fallbackParams.push(needed);

                db.all(fallbackSql, fallbackParams, (err2, moreRows) => {
                    const combined = [...(rows || []), ...(moreRows || [])];
                    return res.json({ topic, count: combined.length, questions: formatQuestions(combined) });
                });
            });
            return;
        }
    }

    // Default: Pick randomly from the subject bank (525+ distinct questions!)
    db.all(`SELECT * FROM questions WHERE topic = ? ORDER BY RANDOM() LIMIT ?`, [topic, count], (err, rows) => {
        if (err || !rows || rows.length === 0) {
            return res.status(404).json({ error: "No questions found for the selected subject." });
        }
        res.json({ topic, count: rows.length, questions: formatQuestions(rows) });
    });
});

// 7. Submit Quiz & Save Score Record
app.post('/api/quiz/submit', (req, res) => {
    const { userId, topic, score, total } = req.body;
    if (!userId) return res.status(400).json({ error: "User ID is required." });

    const totalNum = parseInt(total) || 1;
    const scoreNum = parseInt(score) || 0;
    const percentage = parseFloat(((scoreNum / totalNum) * 100).toFixed(1));
    const date = new Date().toISOString().split('T')[0];

    db.run(
        `INSERT INTO quiz_history (user_id, topic, score, total, percentage, date) VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, topic, scoreNum, totalNum, percentage, date],
        function(err) {
            if (err) return res.status(500).json({ error: "Failed to save quiz result: " + err.message });
            res.json({ 
                message: "Quiz result recorded successfully!", 
                historyId: this.lastID,
                percentage: percentage,
                date: date
            });
        }
    );
});

// 8. User Quiz History & Detailed Learning Analytics
app.get('/api/history/:userId', (req, res) => {
    db.all(`SELECT * FROM quiz_history WHERE user_id = ? ORDER BY id DESC`, [req.params.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: "Failed to fetch quiz history." });
        
        let average = 0;
        let highest = 0;
        let totalQuestions = 0;
        let totalScore = 0;
        const subjectStats = {};

        if (rows && rows.length > 0) {
            const sum = rows.reduce((acc, r) => acc + r.percentage, 0);
            average = parseFloat((sum / rows.length).toFixed(1));
            highest = Math.max(...rows.map(r => r.percentage));
            totalQuestions = rows.reduce((acc, r) => acc + (r.total || 0), 0);
            totalScore = rows.reduce((acc, r) => acc + (r.score || 0), 0);

            // Group by subject/topic
            rows.forEach(r => {
                const top = r.topic || 'General';
                if (!subjectStats[top]) {
                    subjectStats[top] = { topic: top, count: 0, totalPct: 0, totalCorrect: 0, totalQuestions: 0 };
                }
                subjectStats[top].count += 1;
                subjectStats[top].totalPct += r.percentage;
                subjectStats[top].totalCorrect += (r.score || 0);
                subjectStats[top].totalQuestions += (r.total || 0);
            });
        }

        // Format subject metrics
        const subjectBreakdown = Object.values(subjectStats).map(s => ({
            topic: s.topic,
            quizzesTaken: s.count,
            averagePercentage: parseFloat((s.totalPct / s.count).toFixed(1)),
            totalCorrect: s.totalCorrect,
            totalQuestions: s.totalQuestions
        })).sort((a, b) => b.averagePercentage - a.averagePercentage);

        const strongestSubject = subjectBreakdown.length > 0 ? subjectBreakdown[0] : null;
        const weakestSubject = subjectBreakdown.length > 0 ? subjectBreakdown[subjectBreakdown.length - 1] : null;

        // Formulate dynamic study recommendation based on performance
        let recommendation = "Complete your first quiz to generate AI-driven diagnostic feedback.";
        if (rows && rows.length > 0) {
            if (average >= 85) {
                recommendation = `🌟 Exceptional Mastery (${average}% avg)! Your strongest area is ${strongestSubject ? strongestSubject.topic : 'Core Concepts'}. Recommended next step: Advanced Distributed Systems, High-Concurrency Architectures, and System Design.`;
            } else if (average >= 70) {
                recommendation = `📈 Solid Performance (${average}% avg)! You are proficient in ${strongestSubject ? strongestSubject.topic : 'General Topics'}. Priority focus area for improvement: Practice targeted problem sets in ${weakestSubject ? weakestSubject.topic : 'foundational modules'} to reach 90%+.`;
            } else if (average >= 50) {
                recommendation = `⚠️ Moderate Accuracy (${average}% avg). Focus Area Identified: Reinforce core concepts in ${weakestSubject ? weakestSubject.topic : 'your recent subjects'}. Review problem explanations and retake short 5-question quizzes to build consistency.`;
            } else {
                recommendation = `🚨 Foundational Review Needed (${average}% avg). Critical gap identified in ${weakestSubject ? weakestSubject.topic : 'tested subjects'}. Recommended: Review textbook summaries, study key concept definitions, and retry with 'Easy' difficulty quizzes.`;
            }
        }

        res.json({
            history: rows || [],
            analytics: {
                totalQuizzes: rows ? rows.length : 0,
                averageScore: average,
                highestScore: highest,
                totalQuestions: totalQuestions,
                totalScore: totalScore,
                strongestSubject: strongestSubject,
                weakestSubject: weakestSubject,
                subjectBreakdown: subjectBreakdown,
                recommendation: recommendation
            }
        });
    });
});

// Start Server with automatic port fallback (e.g. 3000 -> 3001 if occupied)
const DEFAULT_PORT = process.env.PORT || 3000;

function startServer(port) {
    const serverInstance = app.listen(port, () => {
        console.log(`IntelliQuiz server running on http://localhost:${port}`);
    });

    serverInstance.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            const nextPort = Number(port) + 1;
            console.log(`Port ${port} is occupied, automatically trying port ${nextPort}...`);
            startServer(nextPort);
        } else {
            console.error('Server error:', err);
        }
    });
}

startServer(DEFAULT_PORT);

