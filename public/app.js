// ==========================================================================
// IntelliQuiz AI - Application Core Logic
// ==========================================================================

// Global State
let currentUser = JSON.parse(localStorage.getItem('intelliquiz_user')) || null;
if (currentUser && currentUser.email === 'demo@intelliquiz.edu') {
    localStorage.removeItem('intelliquiz_user');
    currentUser = null;
}
let currentQuizData = null;
let pendingConfig = null;
let userAnswers = {};
let activeQuestionIndex = 0;
let quizTimerInterval = null;
let remainingTimeSeconds = 0;

// Chart.js Instances
let growthChartInstance = null;
let doughnutChartInstance = null;
let subjectBarChartInstance = null;

// Navigation Stack
let sectionHistory = [];
let currentSection = 'homeSection';

// Academic Sample Notes for 1-Click Evaluation
const SAMPLE_NOTES = `Virtual Memory is defined as a memory management technique that provides an idealized abstraction of the storage resources available on any given machine. In modern operating systems, Paging is a memory management scheme by which a computer stores and retrieves data from secondary storage for use in main memory. Demand Paging is specifically used to load pages into memory only when they are referenced during execution. A Page Fault is known as an interrupt that occurs when a software program accesses a memory page that is not currently mapped in physical RAM. The primary purpose of Context Switching is to store the state of an active process so that it can be restored and resume execution at a later point without data corruption. Deadlock Prevention ensures that at least one of Coffman's four conditions (Mutual Exclusion, Hold and Wait, No Preemption, Circular Wait) cannot hold.`;

// Subtopics Mapping
const SUBTOPIC_MAP = {
    'DSA': [
        'Arrays & Strings', 'Linked Lists', 'Stacks & Queues', 
        'Trees & Binary Search Trees', 'Graph Algorithms', 'Sorting & Searching Algorithms'
    ],
    'DBMS': [
        'SQL Queries & DDL/DML', 'Relational Schema & Keys', 'Normalization (1NF, 2NF, 3NF, BCNF)', 
        'Transactions & ACID Properties', 'Indexing & B-Trees', 'Concurrency Control'
    ],
    'Networks': [
        'OSI Reference Model & Layers', 'TCP/IP Protocols & Handshakes', 'IP Addressing & Subnetting', 
        'Routing Protocols (OSPF, BGP)', 'DNS, HTTP/HTTPS, and SSL/TLS', 'Network Security'
    ],
    'OS': [
        'Process Scheduling & Algorithms', 'Memory Management & Virtual Memory', 'Deadlocks & Banker Algorithm', 
        'Threads & Concurrency Synchronization', 'File Systems & Storage IO'
    ],
    'AI_ML': [
        'Supervised vs Unsupervised Learning', 'Neural Networks & Deep Learning', 'Gradient Descent & Optimization', 
        'Feature Engineering & NLP (TF-IDF)', 'Model Evaluation & Confusion Matrices'
    ],
    'Cybersecurity': [
        'Cryptography (Symmetric & Asymmetric)', 'Network Attacks (DDoS, MITM)', 'Web Security (SQLi, XSS)', 
        'Authentication & Access Control', 'Public Key Infrastructure (PKI)'
    ],
    'Software Eng': [
        'Software Development Life Cycle (SDLC)', 'Agile & Scrum Methodologies', 'Design Patterns & OOP', 
        'Software Testing & Quality Assurance', 'System Architecture'
    ],
    'DevOps_Cloud': [
        'CI/CD Pipelines & Automation', 'Containerization & Docker', 'Kubernetes Orchestration', 
        'Cloud Computing Architectures (AWS/Azure)', 'Infrastructure as Code'
    ]
};

// Initialization on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
    updateSubtopics();
    updateCharCount();
});

// Toast Notification System
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(30px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// User Authentication State UI
function updateAuthUI() {
    const authBtn = document.getElementById('authNavBtn');
    const dashGreeting = document.getElementById('dashGreeting');

    if (!authBtn) return;

    if (currentUser) {
        authBtn.innerText = `Logout (${currentUser.name.split(' ')[0]})`;
        authBtn.classList.add('logged-in');
        authBtn.onclick = handleLogout;
        if (dashGreeting) dashGreeting.innerText = `Welcome back, ${currentUser.name}! Track your study diagnostics.`;
    } else {
        authBtn.innerText = 'Login';
        authBtn.classList.remove('logged-in');
        authBtn.onclick = () => showSection('loginSection');
        if (dashGreeting) dashGreeting.innerText = `Welcome! Please log in to view personalized stats.`;
    }
}

// Navigation Handler with Route Protection
function showSection(sectionId, isBackNavigation = false) {
    const protectedSections = [
        'dashboardSection', 
        'createQuizSection', 
        'historySection', 
        'analyticsSection', 
        'instructionsSection', 
        'quizSection', 
        'scorecardSection'
    ];

    if (!currentUser && protectedSections.includes(sectionId)) {
        showToast("Please log in to access this section.", "error");
        showSection('loginSection');
        return;
    }

    if (!isBackNavigation && currentSection !== sectionId) {
        sectionHistory.push(currentSection);
    }

    currentSection = sectionId;

    // Toggle active sections
    document.querySelectorAll('section').forEach(sec => sec.classList.remove('active'));
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Update nav links active styling
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-sec') === sectionId);
    });

    // Lazy load section data
    if (sectionId === 'dashboardSection') loadDashboard();
    if (sectionId === 'historySection') loadHistory();
    if (sectionId === 'analyticsSection') loadAnalytics();
}

function goBack() {
    if (sectionHistory.length > 0) {
        const previousSection = sectionHistory.pop();
        showSection(previousSection, true);
    } else {
        showSection(currentUser ? 'dashboardSection' : 'homeSection', true);
    }
}

// Authentication Actions
async function handleLogin(e) {
    if (e && e.preventDefault) e.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            currentUser = data.user;
            localStorage.setItem('intelliquiz_user', JSON.stringify(currentUser));
            updateAuthUI();
            showToast(`Welcome back, ${currentUser.name}!`, 'success');
            showSection('dashboardSection');
        } else {
            showToast(data.error || "Invalid login credentials.", 'error');
        }
    } catch (err) {
        console.error("Login Error:", err);
        showToast("Unable to reach backend server. Please verify connection.", 'error');
    }
}

async function handleRegister(e) {
    if (e && e.preventDefault) e.preventDefault();

    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            showToast('Registration successful! Please log in.', 'success');
            showSection('loginSection');
        } else {
            showToast(data.error || "Registration failed.", 'error');
        }
    } catch (err) {
        console.error("Registration Error:", err);
        showToast("Server communication error.", 'error');
    }
}

async function handleResetPassword(e) {
    if (e && e.preventDefault) e.preventDefault();

    const email = document.getElementById('resetEmail').value.trim();
    const newPassword = document.getElementById('resetNewPassword').value;
    const confirmPassword = document.getElementById('resetConfirmPassword').value;

    if (newPassword !== confirmPassword) {
        showToast("Passwords do not match.", 'error');
        return;
    }

    try {
        const res = await fetch('/api/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, newPassword })
        });

        const data = await res.json();

        if (res.ok) {
            showToast(data.message, 'success');
            showSection('loginSection');
        } else {
            showToast(data.error || "Password reset failed.", 'error');
        }
    } catch (err) {
        console.error("Password Reset Error:", err);
        showToast("Server error while resetting password.", 'error');
    }
}

function handleLogout(e) {
    if (e && e.preventDefault) e.preventDefault();
    
    currentUser = null;
    localStorage.removeItem('intelliquiz_user');
    updateAuthUI();
    showToast("Logged out successfully.", 'info');
    showSection('homeSection');
}

// Mode Switching & Subtopic Generation
function switchQuizMode(mode) {
    document.getElementById('btnModePredefined').classList.toggle('active', mode === 'predefined');
    document.getElementById('btnModeCustom').classList.toggle('active', mode === 'custom');
    document.getElementById('predefinedModeBox').classList.toggle('hidden', mode !== 'predefined');
    document.getElementById('customModeBox').classList.toggle('hidden', mode !== 'custom');
}

function updateSubtopics() {
    const topicSelect = document.getElementById('topicSelect');
    const subSelect = document.getElementById('subtopicSelect');
    
    if (!topicSelect || !subSelect) return;

    const topic = topicSelect.value;
    subSelect.innerHTML = '<option value="all">All Topics (Comprehensive)</option>';

    if (SUBTOPIC_MAP[topic]) {
        SUBTOPIC_MAP[topic].forEach(sub => {
            subSelect.innerHTML += `<option value="${sub}">${sub}</option>`;
        });
    }
}

function loadSampleText() {
    const txtArea = document.getElementById('textInput');
    if (txtArea) {
        txtArea.value = SAMPLE_NOTES;
        updateCharCount();
        showToast("Sample Operating Systems notes loaded successfully!", "info");
    }
}

function updateCharCount() {
    const txtArea = document.getElementById('textInput');
    const display = document.getElementById('charCountDisplay');
    if (!txtArea || !display) return;

    const chars = txtArea.value.length;
    const words = txtArea.value.trim().split(/\s+/).filter(w => w.length > 0).length;
    display.innerText = `${chars} characters • ${words} words`;
}

function handleFileSelected(event) {
    const file = event.target.files[0];
    const hint = document.getElementById('fileUploadHint');
    if (file && hint) {
        hint.innerHTML = `<span class="upload-icon">📄</span> <strong>${file.name}</strong> (${(file.size / 1024).toFixed(1)} KB selected)`;
        hint.style.color = '#38bdf8';
    }
}

// Quiz Preparation
async function prepareQuiz(mode) {
    if (!currentUser) {
        showToast("Please log in to generate quizzes.", "error");
        return showSection('loginSection');
    }

    if (mode === 'predefined') {
        const topic = document.getElementById('topicSelect').value;
        const subtopic = document.getElementById('subtopicSelect').value;
        const count = document.getElementById('numQuestions').value;
        const difficulty = document.getElementById('difficultySelect').value;
        const timerSeconds = parseInt(document.getElementById('timeLimitSelect').value) || 0;

        pendingConfig = { 
            mode: 'predefined', 
            topic, 
            subtopic, 
            count, 
            difficulty,
            timerSeconds
        };

        document.getElementById('instTopic').innerText = topic;
        document.getElementById('instCount').innerText = count;
        document.getElementById('instDifficulty').innerText = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
        document.getElementById('instTimer').innerText = timerSeconds > 0 ? `${timerSeconds}s / Quiz` : 'No Limit';
        
        showSection('instructionsSection');
    } else {
        const text = document.getElementById('textInput').value.trim();
        const fileInput = document.getElementById('fileInput');
        const hasFile = fileInput.files && fileInput.files[0];

        if (!text && !hasFile) {
            showToast("Please enter study notes or upload a document file.", "error");
            return;
        }

        const count = document.getElementById('aiNumQuestions').value;
        const difficulty = document.getElementById('aiDifficulty').value;
        const aiMode = document.getElementById('aiModeSelect').value;
        const domainHint = document.getElementById('aiDomainSelect').value;
        const timerSeconds = parseInt(document.getElementById('aiTimerSelect').value) || 0;

        pendingConfig = {
            mode: 'custom',
            text,
            hasFile,
            count,
            difficulty,
            aiMode,
            domainHint,
            timerSeconds
        };

        let modeLabel = "AI NLP & TF-IDF Extraction";
        if (aiMode === 'hybrid') modeLabel = "Hybrid AI (TF-IDF + Vector Match)";
        if (aiMode === 'semantic_search') modeLabel = "Vector Space Cosine Search";

        document.getElementById('instTopic').innerText = modeLabel;
        document.getElementById('instCount').innerText = count;
        document.getElementById('instDifficulty').innerText = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
        document.getElementById('instTimer').innerText = timerSeconds > 0 ? `${timerSeconds}s / Quiz` : 'No Limit';

        showSection('instructionsSection');
    }
}

// Start Live Quiz
async function startQuiz() {
    if (!currentUser) return showSection('loginSection');

    // Clear previous timer
    if (quizTimerInterval) clearInterval(quizTimerInterval);

    userAnswers = {};
    activeQuestionIndex = 0;

    const btnStart = document.querySelector('#instructionsSection .btn-primary');
    if (btnStart) btnStart.innerText = "⚡ Preparing Quiz...";

    try {
        if (pendingConfig.mode === 'predefined') {
            const url = `/api/generate/predefined?topic=${encodeURIComponent(pendingConfig.topic)}&subtopic=${encodeURIComponent(pendingConfig.subtopic)}&count=${pendingConfig.count}&difficulty=${pendingConfig.difficulty}`;
            const res = await fetch(url);
            const data = await res.json();
            
            if (res.ok) {
                renderQuiz(data);
            } else {
                showToast(data.error || "Failed to generate predefined quiz.", "error");
            }
        } else {
            const formData = new FormData();
            formData.append('text', pendingConfig.text);
            formData.append('numQuestions', pendingConfig.count);
            formData.append('difficulty', pendingConfig.difficulty);
            formData.append('aiMode', pendingConfig.aiMode);
            formData.append('domainHint', pendingConfig.domainHint);

            const fileInput = document.getElementById('fileInput');
            if (fileInput.files[0]) {
                formData.append('file', fileInput.files[0]);
            }

            const res = await fetch('/api/generate/text', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (res.ok) {
                renderQuiz(data);
            } else {
                showToast(data.error || "Failed to process text via AI NLP pipeline.", "error");
            }
        }
    } catch (err) {
        console.error("Start Quiz Error:", err);
        showToast("Error connecting to quiz generation engine.", "error");
    } finally {
        if (btnStart) btnStart.innerHTML = "<span>🚀 Begin Quiz Now</span>";
    }
}

// Render Live Quiz
function renderQuiz(data) {
    currentQuizData = data;
    document.getElementById('quizTopicTitle').innerText = data.topic;

    const algoBadge = document.getElementById('quizAlgorithmBadge');
    const nlpPanel = document.getElementById('nlpMetricsPanel');
    const nlpPillsWrap = document.getElementById('nlpKeywordsPills');
    const nlpReadabilityBadge = document.getElementById('nlpReadabilityBadge');

    // Display AI / NLP metadata if present
    if (data.nlpMetadata) {
        algoBadge.classList.remove('hidden');
        algoBadge.innerText = data.nlpMetadata.algorithm || "TF-IDF Salience NLP Engine";

        nlpPanel.classList.remove('hidden');
        if (data.nlpMetadata.readingEase !== undefined) {
            nlpReadabilityBadge.innerText = `Readability Score: ${data.nlpMetadata.readingEase} (${data.nlpMetadata.difficulty})`;
        }

        nlpPillsWrap.innerHTML = '';
        if (data.nlpMetadata.topKeywords && data.nlpMetadata.topKeywords.length > 0) {
            data.nlpMetadata.topKeywords.forEach(kw => {
                nlpPillsWrap.innerHTML += `
                    <span class="nlp-pill">${kw.term} <small>TF-IDF: ${kw.score}</small></span>
                `;
            });
        }
    } else {
        algoBadge.classList.add('hidden');
        nlpPanel.classList.add('hidden');
    }

    // Build Question Navigator Pills
    buildQuestionNavPills();

    // Render active question
    displayActiveQuestion();

    // Setup Timer
    setupQuizTimer(pendingConfig.timerSeconds);

    showSection('quizSection');
}

function buildQuestionNavPills() {
    const navPillsContainer = document.getElementById('questionNavPills');
    navPillsContainer.innerHTML = '';

    currentQuizData.questions.forEach((q, idx) => {
        const isAnswered = userAnswers[q.id] !== undefined;
        const isActive = idx === activeQuestionIndex;

        const pill = document.createElement('button');
        pill.className = `q-nav-pill ${isActive ? 'active' : ''} ${isAnswered ? 'answered' : ''}`;
        pill.innerText = idx + 1;
        pill.onclick = () => {
            activeQuestionIndex = idx;
            displayActiveQuestion();
        };
        navPillsContainer.appendChild(pill);
    });
}

function displayActiveQuestion() {
    const totalQuestions = currentQuizData.questions.length;
    const q = currentQuizData.questions[activeQuestionIndex];
    const container = document.getElementById('quizContainer');

    // Update Progress Bar
    const answeredCount = Object.keys(userAnswers).length;
    const progressPct = Math.round(((activeQuestionIndex + 1) / totalQuestions) * 100);
    document.getElementById('quizProgressBar').style.width = `${progressPct}%`;
    document.getElementById('quizProgressLabel').innerText = `Question ${activeQuestionIndex + 1} of ${totalQuestions}`;
    document.getElementById('quizPercentLabel').innerText = `${answeredCount} of ${totalQuestions} Answered`;

    // Render Question Block
    const selectedOpt = userAnswers[q.id];

    container.innerHTML = `
        <div class="question-block">
            <div class="question-stem-header">
                <span class="q-number-tag">Question ${activeQuestionIndex + 1} • Single Choice</span>
                <p class="question-text">${escapeHtml(q.question)}</p>
            </div>

            <div class="options-list">
                ${Object.entries(q.options).map(([letter, text]) => {
                    const isSelected = selectedOpt === letter;
                    return `
                        <div class="option-card ${isSelected ? 'selected' : ''}" onclick="selectOption('${q.id}', '${letter}')">
                            <span class="option-letter-badge">${letter}</span>
                            <span class="option-text">${escapeHtml(text)}</span>
                            <input type="radio" name="opt_${q.id}" value="${letter}" ${isSelected ? 'checked' : ''}>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    // Update prev/next button states
    document.getElementById('btnPrevQuestion').disabled = activeQuestionIndex === 0;
    document.getElementById('btnNextQuestion').disabled = activeQuestionIndex === totalQuestions - 1;

    // Update Pills
    buildQuestionNavPills();
}

function selectOption(qId, letter) {
    userAnswers[qId] = letter;
    displayActiveQuestion();
}

function clearCurrentSelection() {
    const q = currentQuizData.questions[activeQuestionIndex];
    if (q && userAnswers[q.id]) {
        delete userAnswers[q.id];
        displayActiveQuestion();
    }
}

function navigateQuestion(direction) {
    const nextIdx = activeQuestionIndex + direction;
    if (nextIdx >= 0 && nextIdx < currentQuizData.questions.length) {
        activeQuestionIndex = nextIdx;
        displayActiveQuestion();
    }
}

// Timer Setup
function setupQuizTimer(totalSeconds) {
    const timerElem = document.getElementById('quizTimer');
    if (quizTimerInterval) clearInterval(quizTimerInterval);

    if (!totalSeconds || totalSeconds <= 0) {
        timerElem.innerText = "⏱️ Time: Self-Paced";
        timerElem.className = "timer-badge";
        return;
    }

    remainingTimeSeconds = totalSeconds;
    updateTimerDisplay();

    quizTimerInterval = setInterval(() => {
        remainingTimeSeconds--;
        updateTimerDisplay();

        if (remainingTimeSeconds <= 0) {
            clearInterval(quizTimerInterval);
            showToast("Time expired! Submitting answers automatically.", "warning");
            submitQuiz();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const timerElem = document.getElementById('quizTimer');
    const mins = Math.floor(remainingTimeSeconds / 60);
    const secs = remainingTimeSeconds % 60;
    const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    timerElem.innerText = `⏱️ Time Left: ${formatted}`;

    if (remainingTimeSeconds <= 15) {
        timerElem.className = "timer-badge danger";
    } else if (remainingTimeSeconds <= 45) {
        timerElem.className = "timer-badge warning";
    } else {
        timerElem.className = "timer-badge";
    }
}

// Submit Quiz & Evaluate
async function submitQuiz() {
    if (quizTimerInterval) clearInterval(quizTimerInterval);

    let score = 0;
    const total = currentQuizData.questions.length;
    const reviewContainer = document.getElementById('reviewContainer');
    reviewContainer.innerHTML = '';

    currentQuizData.questions.forEach((q, idx) => {
        const studentAns = userAnswers[q.id] || null;
        const isCorrect = studentAns === q.correct;
        if (isCorrect) score++;

        const studentAnsText = studentAns ? `${studentAns}) ${q.options[studentAns] || ''}` : 'No Answer Selected';
        const correctAnsText = `${q.correct}) ${q.options[q.correct] || ''}`;

        reviewContainer.innerHTML += `
            <div class="review-card ${isCorrect ? 'correct' : 'incorrect'}">
                <div class="review-status-bar">
                    <span>Q${idx + 1} Assessment</span>
                    <span>${isCorrect ? '✅ Correct (+1 pt)' : '❌ Incorrect (0 pts)'}</span>
                </div>
                <p class="review-question-text">${escapeHtml(q.question)}</p>
                <div class="review-answers-grid">
                    <div class="review-ans-box">
                        <strong>Your Response</strong>
                        <span style="color: ${isCorrect ? 'var(--success-light)' : 'var(--danger-light)'}; font-weight: 700;">
                            ${escapeHtml(studentAnsText)}
                        </span>
                    </div>
                    <div class="review-ans-box">
                        <strong>Verified Correct Answer</strong>
                        <span style="color: var(--success-light); font-weight: 700;">
                            ${escapeHtml(correctAnsText)}
                        </span>
                    </div>
                </div>
                <div class="review-explanation-box">
                    <strong>Solution Rationale:</strong> ${escapeHtml(q.explanation || 'No rationale available.')}
                    ${q.algorithm ? `<div style="margin-top: 0.5rem; font-size: 0.82rem; color: var(--cyan);">⚡ Generated via: ${q.algorithm}</div>` : ''}
                </div>
            </div>
        `;
    });

    const percentage = parseFloat(((score / total) * 100).toFixed(1));
    document.getElementById('scorePercentage').innerText = `${percentage}%`;
    document.getElementById('scoreSummary').innerText = `Score: ${score} / ${total} Correct (${percentage}%)`;

    // Calculate Grade Badge and Conic Gradient
    const scoreCircle = document.getElementById('scoreCircle');
    const scoreGrade = document.getElementById('scoreGradeBadge');
    const scoreVerdict = document.getElementById('scoreVerdict');

    let grade = 'A+';
    let verdict = "Sensational score! Advanced competency demonstrated across all evaluated concepts.";

    if (percentage >= 90) {
        grade = 'A+';
        verdict = "Outstanding performance! You have mastered this domain's concepts thoroughly.";
    } else if (percentage >= 80) {
        grade = 'A';
        verdict = "Excellent job! Strong technical grasp with minor room for refinement.";
    } else if (percentage >= 65) {
        grade = 'B';
        verdict = "Good progress! Solid foundation, review problem explanations to reach excellence.";
    } else if (percentage >= 50) {
        grade = 'C';
        verdict = "Average performance. Prioritize core definitions and review missed problems.";
    } else {
        grade = 'Needs Review';
        verdict = "Foundational review needed. Recommend reviewing textbook concepts before retaking.";
    }

    scoreGrade.innerText = grade;
    scoreVerdict.innerText = verdict;
    scoreCircle.style.background = `conic-gradient(var(--success) ${percentage}%, var(--border-medium) ${percentage}%)`;

    // Persist Result to Server
    if (currentUser) {
        try {
            await fetch('/api/quiz/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: currentUser.id, 
                    topic: currentQuizData.topic, 
                    score, 
                    total 
                })
            });
            showToast("Quiz record saved to your performance history!", "success");
        } catch (err) {
            console.error("Save Quiz Error:", err);
        }
    }

    showSection('scorecardSection');
}

// Dashboard Loader & Strategic Position Rendering
async function loadDashboard() {
    if (!currentUser) return showSection('loginSection');
    
    try {
        const res = await fetch(`/api/history/${currentUser.id}`);
        const data = await res.json();
        const an = data.analytics;
        const hist = data.history || [];

        // 1. Personalize Welcome Header & Status Avatar
        const avatarElem = document.getElementById('dashAvatar');
        if (avatarElem) {
            const initial = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : '🎓';
            avatarElem.innerText = initial;
        }

        const greetingTitle = document.getElementById('dashGreetingTitle');
        if (greetingTitle) {
            greetingTitle.innerText = `Welcome Back, ${currentUser.name}!`;
        }

        const tierBadge = document.getElementById('dashTierBadge');
        if (tierBadge) {
            const avg = an.averageScore || 0;
            if (avg >= 85) tierBadge.innerHTML = `🏆 Status: Expert (${avg}%)`;
            else if (avg >= 70) tierBadge.innerHTML = `🔷 Status: Proficient (${avg}%)`;
            else if (avg >= 50) tierBadge.innerHTML = `⚡ Status: Developing (${avg}%)`;
            else if (hist.length > 0) tierBadge.innerHTML = `⚠️ Status: Foundational Review`;
            else tierBadge.innerHTML = `⚡ Status: Ready for Assessment`;
        }

        // 2. Populate 4 KPI Metrics
        document.getElementById('dashTotal').innerText = an.totalQuizzes;
        document.getElementById('dashAvg').innerText = `${an.averageScore}%`;
        document.getElementById('dashHighest').innerText = `${an.highestScore}%`;
        document.getElementById('dashQuestions').innerText = `${an.totalScore} / ${an.totalQuestions}`;
        
        const qSub = document.getElementById('dashQuestionsSub');
        if (qSub) {
            qSub.innerText = `${an.totalScore} correct across all tests`;
        }

        // 3. AI Diagnostic & Focus Tags
        document.getElementById('dashRecommendation').innerText = an.recommendation;
        const diagTags = document.getElementById('dashDiagnosticTags');
        if (diagTags) {
            diagTags.innerHTML = '';
            if (an.strongestSubject) {
                diagTags.innerHTML += `<span class="diag-tag strong">🏆 Strongest: ${escapeHtml(an.strongestSubject.topic)} (${an.strongestSubject.averagePercentage}%)</span>`;
            }
            if (an.weakestSubject) {
                diagTags.innerHTML += `<span class="diag-tag focus">🎯 Priority Focus: ${escapeHtml(an.weakestSubject.topic)} (${an.weakestSubject.averagePercentage}%)</span>`;
            }
            if (hist.length === 0) {
                diagTags.innerHTML = `<span class="diag-tag" style="background: rgba(99, 102, 241, 0.2); color: #c7d2fe; border: 1px solid rgba(99, 102, 241, 0.4);">💡 Tip: Take 1 test to unlock full learning diagnostics</span>`;
            }
        }

        // 4. Subject Mastery Snapshot Bars (Side Column)
        const masteryBarsContainer = document.getElementById('dashMasteryBars');
        if (masteryBarsContainer) {
            masteryBarsContainer.innerHTML = '';
            const breakdown = an.subjectBreakdown || [];

            if (breakdown.length > 0) {
                breakdown.slice(0, 5).forEach(sub => {
                    let barColor = 'linear-gradient(90deg, #10b981, #34d399)';
                    let pillClass = 'pct-high';

                    if (sub.averagePercentage >= 80) {
                        barColor = 'linear-gradient(90deg, #10b981, #34d399)';
                        pillClass = 'pct-high';
                    } else if (sub.averagePercentage >= 65) {
                        barColor = 'linear-gradient(90deg, #06b6d4, #38bdf8)';
                        pillClass = 'pct-mid';
                    } else if (sub.averagePercentage >= 50) {
                        barColor = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
                        pillClass = 'pct-fair';
                    } else {
                        barColor = 'linear-gradient(90deg, #f43f5e, #fb7185)';
                        pillClass = 'pct-low';
                    }

                    masteryBarsContainer.innerHTML += `
                        <div class="dash-mini-bar-item">
                            <div class="dash-mini-bar-top">
                                <span style="color: #ffffff;">${escapeHtml(sub.topic)}</span>
                                <span class="mastery-pct-pill ${pillClass}" style="font-size: 0.8rem; padding: 0.1rem 0.5rem;">${sub.averagePercentage}%</span>
                            </div>
                            <div class="mastery-progress-track" style="height: 6px; margin-bottom: 0;">
                                <div class="mastery-progress-bar" style="width: ${sub.averagePercentage}%; background: ${barColor};"></div>
                            </div>
                        </div>
                    `;
                });
            } else {
                masteryBarsContainer.innerHTML = `
                    <div style="padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.88rem;">
                        No assessments recorded yet. Launch a quiz below to begin tracking subject mastery!
                    </div>
                `;
            }
        }

        // 5. Recent Activity Table (Bottom Section)
        const recentTableBody = document.getElementById('dashRecentTableBody');
        if (recentTableBody) {
            recentTableBody.innerHTML = '';
            if (hist.length > 0) {
                hist.slice(0, 4).forEach(row => {
                    let statusBadge = '<span class="status-badge status-passed">Mastered</span>';
                    if (row.percentage < 50) statusBadge = '<span class="status-badge status-danger">Needs Review</span>';
                    else if (row.percentage < 75) statusBadge = '<span class="status-badge status-review">Proficient</span>';

                    recentTableBody.innerHTML += `
                        <tr>
                            <td>${escapeHtml(row.date)}</td>
                            <td><strong>${escapeHtml(row.topic)}</strong></td>
                            <td>${row.score} / ${row.total}</td>
                            <td><strong style="color: #ffffff;">${row.percentage}%</strong></td>
                            <td>${statusBadge}</td>
                        </tr>
                    `;
                });
            } else {
                recentTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 1.5rem; color: var(--text-muted);">
                            No recent quizzes taken. Click "⚡ Create Practice Quiz" or select a Quick Launcher to start!
                        </td>
                    </tr>
                `;
            }
        }

    } catch (err) {
        console.error("Load Dashboard Error:", err);
    }
}

// 1-Click Quick Subject Launch from Dashboard Chips
function quickLaunchSubject(topic) {
    if (!currentUser) return showSection('loginSection');

    // Pre-configure options
    const topicSelect = document.getElementById('topicSelect');
    if (topicSelect) topicSelect.value = topic;
    updateSubtopics();

    pendingConfig = {
        mode: 'predefined',
        topic: topic,
        subtopic: 'all',
        count: '5',
        difficulty: 'medium',
        timerSeconds: 0
    };

    document.getElementById('instTopic').innerText = topic;
    document.getElementById('instCount').innerText = '5';
    document.getElementById('instDifficulty').innerText = 'Medium';
    document.getElementById('instTimer').innerText = 'No Limit';

    showSection('instructionsSection');
}

// 1-Click Quick Launch AI Notes Generator from Dashboard
function quickLaunchCustomAI() {
    if (!currentUser) return showSection('loginSection');
    showSection('createQuizSection');
    switchQuizMode('custom');
    loadSampleText();
}

// High-Contrast Performance & Learning Analytics
async function loadAnalytics() {
    if (!currentUser) return showSection('loginSection');

    try {
        const res = await fetch(`/api/history/${currentUser.id}`);
        const data = await res.json();

        const an = data.analytics;
        const hist = data.history || [];

        // Fill KPI Cards
        document.getElementById('anTotalQuizzes').innerText = an.totalQuizzes;
        document.getElementById('anAvgScore').innerText = `${an.averageScore}%`;
        document.getElementById('anHighestScore').innerText = `${an.highestScore}%`;
        document.getElementById('anTotalQuestions').innerText = an.totalQuestions;
        document.getElementById('anQuestionsCorrect').innerText = `${an.totalScore} correct answers`;
        document.getElementById('analyticsDiagnostic').innerText = an.recommendation;

        // Diagnostic Tags
        const diagTags = document.getElementById('aiDiagnosticTags');
        diagTags.innerHTML = '';
        if (an.strongestSubject) {
            diagTags.innerHTML += `<span class="diag-tag strong">🏆 Strongest: ${an.strongestSubject.topic} (${an.strongestSubject.averagePercentage}%)</span>`;
        }
        if (an.weakestSubject) {
            diagTags.innerHTML += `<span class="diag-tag focus">🎯 Priority Focus: ${an.weakestSubject.topic} (${an.weakestSubject.averagePercentage}%)</span>`;
        }

        // Subject Mastery Grid
        const masteryGrid = document.getElementById('subjectMasteryGrid');
        masteryGrid.innerHTML = '';

        if (an.subjectBreakdown && an.subjectBreakdown.length > 0) {
            an.subjectBreakdown.forEach(sub => {
                let badgeClass = 'pct-high';
                let ratingText = '🏆 Mastered';
                let barColor = 'linear-gradient(90deg, #10b981, #34d399)';

                if (sub.averagePercentage >= 80) {
                    badgeClass = 'pct-high';
                    ratingText = '🏆 Mastered';
                    barColor = 'linear-gradient(90deg, #10b981, #34d399)';
                } else if (sub.averagePercentage >= 65) {
                    badgeClass = 'pct-mid';
                    ratingText = '🔷 Proficient';
                    barColor = 'linear-gradient(90deg, #06b6d4, #38bdf8)';
                } else if (sub.averagePercentage >= 50) {
                    badgeClass = 'pct-fair';
                    ratingText = '⚡ Developing';
                    barColor = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
                } else {
                    badgeClass = 'pct-low';
                    ratingText = '⚠️ Focus Required';
                    barColor = 'linear-gradient(90deg, #f43f5e, #fb7185)';
                }

                masteryGrid.innerHTML += `
                    <div class="mastery-card">
                        <div class="mastery-top-row">
                            <span class="mastery-topic-title">${escapeHtml(sub.topic)}</span>
                            <span class="mastery-pct-pill ${badgeClass}">${sub.averagePercentage}%</span>
                        </div>
                        <div class="mastery-progress-track">
                            <div class="mastery-progress-bar" style="width: ${sub.averagePercentage}%; background: ${barColor};"></div>
                        </div>
                        <div class="mastery-bottom-row">
                            <span>${sub.quizzesTaken} Tests • ${sub.totalCorrect}/${sub.totalQuestions} Questions</span>
                            <strong style="color: #ffffff;">${ratingText}</strong>
                        </div>
                    </div>
                `;
            });
        } else {
            masteryGrid.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1;">Complete quizzes to generate topic competency analytics.</p>`;
        }

        // Render Recent Quizzes Table
        const tableBody = document.getElementById('analyticsTableBody');
        tableBody.innerHTML = '';
        hist.slice(0, 8).forEach(row => {
            let statusBadge = '<span class="status-badge status-passed">Passed</span>';
            if (row.percentage < 50) statusBadge = '<span class="status-badge status-danger">Needs Review</span>';
            else if (row.percentage < 75) statusBadge = '<span class="status-badge status-review">Proficient</span>';

            tableBody.innerHTML += `
                <tr>
                    <td>${escapeHtml(row.date)}</td>
                    <td><strong>${escapeHtml(row.topic)}</strong></td>
                    <td>${row.score} / ${row.total}</td>
                    <td><strong style="color: #ffffff;">${row.percentage}%</strong></td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        });

        // -------------------------------------------------------------
        // Render High-Contrast Chart.js Visualizations
        // -------------------------------------------------------------

        // 1. Line Chart: Growth Progression
        const ctxLine = document.getElementById('growthChart').getContext('2d');
        const labels = hist.map((_, i) => `Test #${hist.length - i}`).reverse();
        const scores = hist.map(h => h.percentage).reverse();

        if (growthChartInstance) growthChartInstance.destroy();

        growthChartInstance = new Chart(ctxLine, {
            type: 'line',
            data: {
                labels: labels.length ? labels : ['No Data'],
                datasets: [{
                    label: 'Score Percentage (%)',
                    data: scores.length ? scores : [0],
                    borderColor: '#06b6d4',
                    borderWidth: 3,
                    backgroundColor: 'rgba(6, 182, 212, 0.15)',
                    pointBackgroundColor: '#34d399',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    fill: true,
                    tension: 0.35
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#ffffff', font: { weight: 'bold' } }
                    },
                    tooltip: {
                        backgroundColor: '#111e38',
                        titleColor: '#38bdf8',
                        bodyColor: '#ffffff',
                        borderColor: '#06b6d4',
                        borderWidth: 1.5,
                        padding: 12
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.08)' },
                        ticks: { color: '#cbd5e1', font: { weight: '600' } }
                    },
                    y: {
                        min: 0,
                        max: 100,
                        grid: { color: 'rgba(255, 255, 255, 0.08)' },
                        ticks: { 
                            color: '#cbd5e1', 
                            font: { weight: '600' },
                            callback: value => `${value}%`
                        }
                    }
                }
            }
        });

        // 2. Doughnut Chart: Accuracy Distribution
        const ctxDoughnut = document.getElementById('accuracyDoughnutChart').getContext('2d');
        const totalCorrect = an.totalScore || 0;
        const totalIncorrect = Math.max(0, (an.totalQuestions || 0) - totalCorrect);

        if (doughnutChartInstance) doughnutChartInstance.destroy();

        doughnutChartInstance = new Chart(ctxDoughnut, {
            type: 'doughnut',
            data: {
                labels: ['Correct Answers', 'Incorrect / Skipped'],
                datasets: [{
                    data: (totalCorrect + totalIncorrect > 0) ? [totalCorrect, totalIncorrect] : [1, 0],
                    backgroundColor: ['#10b981', '#f43f5e'],
                    borderColor: '#0d1527',
                    borderWidth: 3,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#ffffff', font: { weight: 'bold' }, padding: 14 }
                    }
                },
                cutout: '70%'
            }
        });

        // 3. Bar Chart: Subject Mastery Breakdown
        const ctxBar = document.getElementById('subjectBarChart').getContext('2d');
        const barLabels = (an.subjectBreakdown || []).map(s => s.topic);
        const barData = (an.subjectBreakdown || []).map(s => s.averagePercentage);
        const barColors = barData.map(val => {
            if (val >= 80) return '#10b981';
            if (val >= 65) return '#06b6d4';
            if (val >= 50) return '#f59e0b';
            return '#f43f5e';
        });

        if (subjectBarChartInstance) subjectBarChartInstance.destroy();

        subjectBarChartInstance = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: barLabels.length ? barLabels : ['No Assessments'],
                datasets: [{
                    label: 'Subject Mastery (%)',
                    data: barData.length ? barData : [0],
                    backgroundColor: barColors.length ? barColors : ['#6366f1'],
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#ffffff', font: { weight: 'bold' } }
                    },
                    tooltip: {
                        backgroundColor: '#111e38',
                        titleColor: '#ffffff',
                        bodyColor: '#38bdf8',
                        borderColor: '#2a3c61',
                        borderWidth: 1.5
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.08)' },
                        ticks: { color: '#ffffff', font: { weight: 'bold' } }
                    },
                    y: {
                        min: 0,
                        max: 100,
                        grid: { color: 'rgba(255, 255, 255, 0.08)' },
                        ticks: { 
                            color: '#cbd5e1', 
                            font: { weight: '600' },
                            callback: value => `${value}%`
                        }
                    }
                }
            }
        });

    } catch (err) {
        console.error("Load Analytics Error:", err);
    }
}

// Full Quiz History Table Loader
let fullHistoryCache = [];

async function loadHistory() {
    if (!currentUser) return showSection('loginSection');

    try {
        const res = await fetch(`/api/history/${currentUser.id}`);
        const data = await res.json();
        fullHistoryCache = data.history || [];
        renderHistoryTable(fullHistoryCache);
    } catch (err) {
        console.error("Load History Error:", err);
    }
}

function filterHistoryTable() {
    const filter = document.getElementById('historyTopicFilter').value;
    if (filter === 'all') {
        renderHistoryTable(fullHistoryCache);
    } else {
        const filtered = fullHistoryCache.filter(h => h.topic.toLowerCase().includes(filter.toLowerCase()));
        renderHistoryTable(filtered);
    }
}

function renderHistoryTable(rows) {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';

    if (!rows || rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No quiz records found. Take your first quiz!</td></tr>`;
        return;
    }

    rows.forEach(row => {
        let statusBadge = '<span class="status-badge status-passed">Mastered</span>';
        if (row.percentage < 50) statusBadge = '<span class="status-badge status-danger">Needs Review</span>';
        else if (row.percentage < 75) statusBadge = '<span class="status-badge status-review">Proficient</span>';

        tbody.innerHTML += `
            <tr>
                <td>${escapeHtml(row.date)}</td>
                <td><strong>${escapeHtml(row.topic)}</strong></td>
                <td>${row.score} / ${row.total}</td>
                <td><strong style="color: #ffffff;">${row.percentage}%</strong></td>
                <td>${statusBadge}</td>
            </tr>
        `;
    });
}

// Safe HTML Escaping Helper
function escapeHtml(text) {
    if (!text) return '';
    return text
        .toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
