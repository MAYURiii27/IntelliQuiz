/**
 * IntelliQuiz AI & NLP Question Generation Engine
 * Uses TF-IDF, N-Gram Collocation, Sentence Salience Scoring,
 * Pattern-based Concept Extraction, and Cosine Similarity.
 */

// Stop words list (English + Academic/Filler words)
const STOP_WORDS = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t',
    'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
    'can', 'can\'t', 'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing',
    'don\'t', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t',
    'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers',
    'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if',
    'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t',
    'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our',
    'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s',
    'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs',
    'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re',
    'they\'ve', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t',
    'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s',
    'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t',
    'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself',
    'yourselves', 'also', 'therefore', 'furthermore', 'moreover', 'however', 'thus', 'hence', 'whereas',
    'etc', 'example', 'given', 'using', 'used', 'use', 'based', 'often', 'within', 'across', 'among',
    'allows', 'allow', 'provides', 'provide', 'shown', 'shows', 'fig', 'figure', 'page', 'chapter', 'section',
    'modern', 'standard', 'typical', 'various', 'following', 'different', 'primary', 'general', 'overall'
]);

// Domain knowledge distractors organized by IT engineering fields
const DOMAIN_DISTRACTORS = {
    'dsa': [
        'Binary Search Tree', 'Hash Map', 'Red-Black Tree', 'Quick Sort', 'Dijkstra Algorithm', 
        'Dynamic Programming', 'Breadth-First Search', 'Priority Queue', 'Adjacency List', 
        'Trie Data Structure', 'Merge Sort', 'Heap Sort', 'Linked List', 'Depth-First Search',
        'Balanced AVL Tree', 'Graph Traversal', 'Greedy Algorithm', 'Time Complexity O(log n)'
    ],
    'dbms': [
        'Relational Schema', 'B-Tree Indexing', 'ACID Properties', 'Foreign Key Constraint', 
        'Second Normal Form (2NF)', 'Third Normal Form (3NF)', 'Transaction Rollback', 'Query Optimizer', 
        'Entity Relationship Diagram', 'Stored Procedure', 'NoSQL Document Store', 'Write-Ahead Logging',
        'Database Sharding', 'Concurrency Control', 'Dirty Read Anomaly', 'Two-Phase Locking'
    ],
    'os': [
        'Virtual Memory', 'Context Switching', 'Round Robin Scheduling', 'Mutual Exclusion', 
        'Page Fault Handling', 'Deadlock Detection', 'Kernel Space', 'Counting Semaphore', 
        'Critical Section', 'Demand Paging', 'Thread Synchronization', 'File Allocation Table',
        'Inter-Process Communication', 'Preemptive Multitasking', 'Thrashing', 'Banker\'s Algorithm'
    ],
    'networks': [
        'Transmission Control Protocol (TCP)', 'User Datagram Protocol (UDP)', 'Domain Name System (DNS)', 
        'Border Gateway Protocol (BGP)', 'OSI Reference Model', 'Subnet Masking', 'Address Resolution Protocol (ARP)', 
        'HTTP/2 Protocol', 'Transport Layer Security (TLS)', 'Packet Switching', 'Routing Information Protocol',
        'Dynamic Host Configuration Protocol', 'Three-Way Handshake', 'Congestion Window'
    ],
    'ai_ml': [
        'Supervised Learning', 'Gradient Descent', 'Convolutional Neural Network', 'Overfitting Prevention', 
        'Backpropagation Algorithm', 'Recurrent Neural Network', 'Support Vector Machine', 'Random Forest Classifier', 
        'Confusion Matrix Evaluation', 'Cosine Similarity', 'TF-IDF Vectorization', 'Hyperparameter Tuning',
        'Regularization (L1/L2)', 'K-Means Clustering', 'Principal Component Analysis', 'Activation Function'
    ],
    'cybersecurity': [
        'Public Key Infrastructure (PKI)', 'SQL Injection Prevention', 'Cross-Site Scripting (XSS)', 
        'Symmetric Encryption', 'Zero Trust Architecture', 'Distributed Denial of Service (DDoS)', 
        'Multi-Factor Authentication', 'Penetration Testing', 'Cryptographic Hash Function',
        'Address Space Layout Randomization', 'Man-in-the-Middle Attack', 'Intrusion Detection System'
    ],
    'general': [
        'Algorithm Complexity', 'Data Abstraction', 'System Throughput', 'Asynchronous Processing', 
        'Encapsulation', 'Microservices Architecture', 'Continuous Integration', 'Load Balancing', 
        'Cache Invalidation', 'Event-Driven Architecture', 'Object Relational Mapping', 'Fault Tolerance'
    ]
};

// Flattened pool of all domain concepts
const ALL_CONCEPTS_POOL = Object.values(DOMAIN_DISTRACTORS).flat();

// Action and linking verbs that shouldn't trail candidate noun phrases
const VERB_FILTER = new Set([
    'load', 'stores', 'stores', 'used', 'using', 'runs', 'provides', 'contains', 'occur', 'occurs',
    'referenced', 'defined', 'known', 'executes', 'executing', 'implements', 'handles', 'managed',
    'manages', 'demands', 'processes', 'resumes', 'restored', 'accesses', 'mapped'
]);

function cleanSubjectTerm(term) {
    if (!term) return '';
    return term
        .replace(/^(a|an|the)\s+/i, '')
        .replace(/['":;.,!?]/g, '')
        .trim();
}

/**
 * Clean raw text, stripping academic headers, page numbers, links, excess whitespace.
 */
function cleanTechnicalText(text) {
    if (!text) return "";
    let cleaned = text
        .replace(/page \d+ of \d+/gi, ' ')
        .replace(/chapter \d+/gi, ' ')
        .replace(/lecture \d+/gi, ' ')
        .replace(/syllabus/gi, ' ')
        .replace(/all rights reserved/gi, ' ')
        .replace(/https?:\/\/\S+/gi, ' ')
        .replace(/www\.\S+/gi, ' ')
        .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, ' ')
        .replace(/\r\n/g, '\n')
        .replace(/\t/g, ' ')
        .replace(/[ ]{2,}/g, ' ');
    return cleaned.trim();
}

/**
 * Tokenize text into valid sentences while respecting abbreviations, decimals, and technical symbols.
 */
function tokenizeSentences(text) {
    if (!text) return [];
    // Protect abbreviations and decimals
    let protectedText = text
        .replace(/(\be\.g\.)/gi, 'E_G_ABBR')
        .replace(/(\bi\.e\.)/gi, 'I_E_ABBR')
        .replace(/(\betc\.)/gi, 'ETC_ABBR')
        .replace(/(\bvs\.)/gi, 'VS_ABBR')
        .replace(/(\bFig\.)/gi, 'FIG_ABBR')
        .replace(/(\bEq\.)/gi, 'EQ_ABBR')
        .replace(/(\bNo\.)/gi, 'NO_ABBR')
        .replace(/(\bDept\.)/gi, 'DEPT_ABBR')
        .replace(/(\bUniv\.)/gi, 'UNIV_ABBR')
        .replace(/(\d+)\.(\d+)/g, '$1_DOT_$2');

    // Split on sentence boundaries: period, question mark, exclamation, or double newlines
    let rawSentences = protectedText.split(/(?<=[.?!])\s+|\n{2,}/);

    let sentences = [];
    for (let s of rawSentences) {
        let restored = s
            .replace(/E_G_ABBR/g, 'e.g.')
            .replace(/I_E_ABBR/g, 'i.e.')
            .replace(/ETC_ABBR/g, 'etc.')
            .replace(/VS_ABBR/g, 'vs.')
            .replace(/FIG_ABBR/g, 'Fig.')
            .replace(/EQ_ABBR/g, 'Eq.')
            .replace(/NO_ABBR/g, 'No.')
            .replace(/DEPT_ABBR/g, 'Dept.')
            .replace(/UNIV_ABBR/g, 'Univ.')
            .replace(/_DOT_/g, '.')
            .trim();

        // Keep sentences with substantive content (between 6 and 60 words)
        const wordCount = restored.split(/\s+/).length;
        if (wordCount >= 6 && wordCount <= 75) {
            sentences.push(restored);
        }
    }
    return sentences;
}

/**
 * Tokenize a sentence or text into filtered words (lowercase, non-stopwords, min length 3).
 */
function tokenizeWords(text) {
    if (!text) return [];
    return text
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
}

/**
 * Extract N-grams (bi-grams and tri-grams) to capture technical multi-word phrases.
 */
function extractNgrams(words, n = 2) {
    let ngrams = [];
    for (let i = 0; i <= words.length - n; i++) {
        const slice = words.slice(i, i + n);
        // Exclude ngrams that begin or end with generic short tokens
        if (slice.every(w => !STOP_WORDS.has(w) && w.length >= 3)) {
            ngrams.push(slice.join(' '));
        }
    }
    return ngrams;
}

/**
 * Compute TF-IDF over an array of sentences.
 * Returns: { termScores, sentenceScores, topKeywords }
 */
function computeTfIdf(sentences) {
    const totalDocs = sentences.length;
    if (totalDocs === 0) return { termScores: {}, sentenceScores: [], topKeywords: [] };

    // Document frequencies (DF)
    const docFrequency = {};
    const sentenceTokens = [];

    sentences.forEach((sentence, sIdx) => {
        const words = tokenizeWords(sentence);
        const bigrams = extractNgrams(words, 2);
        const trigrams = extractNgrams(words, 3);
        const allTerms = [...words, ...bigrams, ...trigrams];
        sentenceTokens.push(allTerms);

        const uniqueTerms = new Set(allTerms);
        uniqueTerms.forEach(term => {
            docFrequency[term] = (docFrequency[term] || 0) + 1;
        });
    });

    // Compute TF and TF-IDF
    const sentenceScores = [];
    const globalTermWeights = {};

    sentences.forEach((sentence, sIdx) => {
        const terms = sentenceTokens[sIdx];
        const termCounts = {};
        terms.forEach(t => { termCounts[t] = (termCounts[t] || 0) + 1; });

        let sentenceTfIdfSum = 0;
        const totalTermsInSentence = terms.length || 1;

        for (const [term, count] of Object.entries(termCounts)) {
            // Augmented term frequency
            const tf = count / totalTermsInSentence;
            // Standard smooth IDF: log((1 + N) / (1 + df)) + 1
            const idf = Math.log((1 + totalDocs) / (1 + (docFrequency[term] || 1))) + 1.0;
            // Boost multi-word n-grams because technical concepts are typically phrases
            const ngramBoost = term.includes(' ') ? 1.5 : 1.0;
            const tfidf = tf * idf * ngramBoost;

            sentenceTfIdfSum += tfidf;
            globalTermWeights[term] = (globalTermWeights[term] || 0) + tfidf;
        }

        // Length normalization: prefer sentences with rich information density
        const normScore = sentenceTfIdfSum / Math.sqrt(totalTermsInSentence);
        sentenceScores.push({
            sentence,
            index: sIdx,
            score: normScore,
            terms: terms
        });
    });

    // Sort top keywords across document
    const topKeywords = Object.entries(globalTermWeights)
        .map(([term, score]) => ({
            term,
            score: parseFloat(score.toFixed(3)),
            isPhrase: term.includes(' ')
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 30);

    return {
        termScores: globalTermWeights,
        sentenceScores,
        topKeywords
    };
}

/**
 * Measure document readability & complexity metrics (Flesch-Kincaid & ARI approximation).
 */
function calculateDocumentMetrics(text, sentences) {
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    const sentenceCount = sentences.length || 1;
    const charCount = text.replace(/\s+/g, '').length;

    // Approximate syllable count
    let syllableCount = 0;
    words.forEach(w => {
        const clean = w.toLowerCase().replace(/[^a-z]/g, '');
        if (clean.length <= 3) {
            syllableCount += 1;
        } else {
            const matches = clean.match(/[aeiouy]{1,2}/g);
            syllableCount += matches ? matches.length : 1;
        }
    });

    const avgWordsPerSentence = wordCount / sentenceCount;
    const avgSyllablesPerWord = syllableCount / (wordCount || 1);

    // Flesch Reading Ease: 206.835 - 1.015 * (words/sentence) - 84.6 * (syllables/words)
    const readingEase = Math.max(0, Math.min(100, 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord)));
    
    let difficulty = 'Medium';
    if (readingEase < 45 || avgWordsPerSentence > 22) difficulty = 'Hard';
    else if (readingEase > 70 && avgWordsPerSentence < 14) difficulty = 'Easy';

    return {
        wordCount,
        sentenceCount,
        readingEase: parseFloat(readingEase.toFixed(1)),
        difficulty,
        avgWordsPerSentence: parseFloat(avgWordsPerSentence.toFixed(1))
    };
}

function isValidCandidateTerm(term) {
    if (!term || typeof term !== 'string') return false;
    const clean = term.toLowerCase().trim();
    if (clean.length < 3 || clean.length > 35) return false;
    if (STOP_WORDS.has(clean)) return false;
    const parts = clean.split(' ');
    // Reject if any part is a verb or stopword
    if (parts.some(p => STOP_WORDS.has(p) || VERB_FILTER.has(p))) return false;
    // Reject pure numbers
    if (/^\d+$/.test(clean)) return false;
    return true;
}

/**
 * Pick 3 smart distractors for a correct answer using semantic context & domain knowledge.
 */
function selectDistractors(correctAnswer, candidateTerms, domainHint = 'general') {
    const cleanTarget = cleanSubjectTerm(correctAnswer).toLowerCase().trim();
    const distractors = new Set();
    const addedWords = new Set([cleanTarget]);

    // 1. First priority: High-relevance candidate terms from the text
    for (const item of candidateTerms) {
        const candidate = cleanSubjectTerm(item.term || item);
        const normCand = candidate.toLowerCase();
        if (
            isValidCandidateTerm(normCand) &&
            normCand !== cleanTarget &&
            !cleanTarget.includes(normCand) &&
            !normCand.includes(cleanTarget) &&
            !addedWords.has(normCand) &&
            distractors.size < 3
        ) {
            distractors.add(formatConceptName(candidate));
            addedWords.add(normCand);
        }
    }

    // 2. Second priority: Matching domain knowledge distractors
    const domainList = DOMAIN_DISTRACTORS[domainHint.toLowerCase()] || DOMAIN_DISTRACTORS['general'];
    const shuffledDomain = [...domainList].sort(() => 0.5 - Math.random());

    for (const domItem of shuffledDomain) {
        const normDom = cleanSubjectTerm(domItem).toLowerCase();
        if (
            normDom !== cleanTarget &&
            !cleanTarget.includes(normDom) &&
            !normDom.includes(cleanTarget) &&
            !addedWords.has(normDom) &&
            distractors.size < 3
        ) {
            distractors.add(domItem);
            addedWords.add(normDom);
        }
    }

    // 3. Fallback: Global concept pool if still less than 3
    if (distractors.size < 3) {
        const shuffledAll = [...ALL_CONCEPTS_POOL].sort(() => 0.5 - Math.random());
        for (const fallback of shuffledAll) {
            const normF = cleanSubjectTerm(fallback).toLowerCase();
            if (
                normF !== cleanTarget &&
                !cleanTarget.includes(normF) &&
                !normF.includes(cleanTarget) &&
                !addedWords.has(normF) &&
                distractors.size < 3
            ) {
                distractors.add(fallback);
                addedWords.add(normF);
            }
        }
    }

    return Array.from(distractors).slice(0, 3);
}

/**
 * Helper to capitalize concept names nicely (e.g. "binary search" -> "Binary Search").
 */
function formatConceptName(str) {
    if (!str) return '';
    return str
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

/**
 * Shuffle options array and return { options: { A, B, C, D }, correctLetter }
 */
function packageOptions(correctAnswer, distractors) {
    const allOptions = [
        { text: formatConceptName(correctAnswer), isCorrect: true },
        ...distractors.map(d => ({ text: formatConceptName(d), isCorrect: false }))
    ];

    // Fisher-Yates shuffle
    for (let i = allOptions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
    }

    const letters = ['A', 'B', 'C', 'D'];
    const optionsObj = {};
    let correctLetter = 'A';

    allOptions.forEach((opt, idx) => {
        const letter = letters[idx];
        optionsObj[letter] = opt.text;
        if (opt.isCorrect) correctLetter = letter;
    });

    return { options: optionsObj, correct: correctLetter };
}

/**
 * NLP Pattern Matcher: extracts definition and purpose statements
 */
const DEFINITION_PATTERNS = [
    {
        // "X is defined as Y" or "X can be defined as Y"
        regex: /(?<subject>[A-Za-z0-9 _-]{3,35})\s+(?:is defined as|can be defined as|refers to|is known as)\s+(?<definition>[^.;]+)/i,
        type: 'definition'
    },
    {
        // "The primary purpose of X is Y"
        regex: /the (?:primary|main|core)?\s*(?:purpose|function|goal|objective) of\s+(?<subject>[A-Za-z0-9 _-]{3,35})\s+is\s+(?<definition>[^.;]+)/i,
        type: 'purpose'
    },
    {
        // "X is an algorithm / technique for Y"
        regex: /(?<subject>[A-Za-z0-9 _-]{3,35})\s+is (?:a|an)\s+(?:technique|algorithm|protocol|data structure|mechanism|process|paradigm|framework)\s+(?:for|that|which|to)\s+(?<definition>[^.;]+)/i,
        type: 'classification'
    },
    {
        // "X is used to / for Y"
        regex: /(?<subject>[A-Za-z0-9 _-]{3,35})\s+is\s+used\s+(?:to|for)\s+(?<definition>[^.;]+)/i,
        type: 'usage'
    }
];

/**
 * Generate AI Multiple Choice Questions from text using TF-IDF and NLP.
 */
function generateAIQuizFromText(rawText, options = {}) {
    const numQuestions = parseInt(options.numQuestions) || 5;
    const requestedDifficulty = options.difficulty || 'medium';
    const domainHint = options.domainHint || 'general';

    const cleanedText = cleanTechnicalText(rawText);
    const sentences = tokenizeSentences(cleanedText);

    if (sentences.length === 0) {
        throw new Error("Insufficient readable content in text. Please provide at least 2-3 substantive sentences.");
    }

    const docMetrics = calculateDocumentMetrics(cleanedText, sentences);
    const { termScores, sentenceScores, topKeywords } = computeTfIdf(sentences);

    // Sort sentences by informational salience score descending
    const rankedSentences = [...sentenceScores].sort((a, b) => b.score - a.score);

    const generatedQuestions = [];
    const usedStems = new Set();
    const usedTargetTerms = new Set();

    // Pass 1: Pattern-based conceptual extraction
    for (const item of rankedSentences) {
        if (generatedQuestions.length >= numQuestions) break;
        const sentence = item.sentence;

        for (const pat of DEFINITION_PATTERNS) {
            const match = sentence.match(pat.regex);
            if (match && match.groups && match.groups.subject && match.groups.definition) {
                const rawSubject = match.groups.subject.trim();
                const subject = cleanSubjectTerm(rawSubject);
                const definition = match.groups.definition.trim();

                // Validate length and quality
                if (
                    subject.length >= 3 && subject.length <= 40 &&
                    definition.length >= 15 && definition.length <= 150 &&
                    !STOP_WORDS.has(subject.toLowerCase()) &&
                    !usedTargetTerms.has(subject.toLowerCase())
                ) {
                    let stem = "";
                    if (pat.type === 'definition') {
                        stem = `According to the text, which concept is defined as: "${definition.charAt(0).toUpperCase() + definition.slice(1)}"?`;
                    } else if (pat.type === 'purpose') {
                        stem = `Which mechanism or concept has the primary purpose of: "${definition.charAt(0).toUpperCase() + definition.slice(1)}"?`;
                    } else if (pat.type === 'classification') {
                        stem = `Which technical concept or mechanism "${definition}"?`;
                    } else {
                        stem = `In this system, what is specifically used to "${definition}"?`;
                    }

                    if (!usedStems.has(stem)) {
                        const distractors = selectDistractors(subject, topKeywords, domainHint);
                        const { options, correct } = packageOptions(subject, distractors);

                        generatedQuestions.push({
                            id: generatedQuestions.length + 1,
                            question: stem,
                            options,
                            correct,
                            explanation: `Context from text: "${sentence}". The concept '${formatConceptName(subject)}' is directly identified by this definition.`,
                            algorithm: "NLP Linguistic Pattern & TF-IDF Concept Extraction",
                            keyConcept: formatConceptName(subject),
                            difficulty: docMetrics.difficulty
                        });

                        usedStems.add(stem);
                        usedTargetTerms.add(subject.toLowerCase());
                        break;
                    }
                }
            }
        }
    }

    // Pass 2: Salient Concept Masking (Cloze / Key Term Extraction) via TF-IDF Weighting
    for (const item of rankedSentences) {
        if (generatedQuestions.length >= numQuestions) break;
        const sentence = item.sentence;

        // Find candidate keywords in this sentence that have high TF-IDF
        const wordsInSentence = tokenizeWords(sentence);
        const bigramsInSentence = extractNgrams(wordsInSentence, 2);
        const allSentenceTerms = [...bigramsInSentence, ...wordsInSentence];

        // Find the term with highest TF-IDF in this sentence
        let bestTerm = null;
        let maxWeight = -1;

        for (const term of allSentenceTerms) {
            const weight = termScores[term] || 0;
            if (
                weight > maxWeight &&
                term.length >= 4 &&
                !STOP_WORDS.has(term) &&
                !usedTargetTerms.has(term.toLowerCase())
            ) {
                // Ensure term exists literally in sentence with case sensitivity check
                const regex = new RegExp(`\\b${term}\\b`, 'i');
                if (regex.test(sentence)) {
                    maxWeight = weight;
                    bestTerm = term;
                }
            }
        }

        if (bestTerm) {
            // Find the exact matching string casing in original sentence
            const regex = new RegExp(`\\b(${bestTerm})\\b`, 'i');
            const match = sentence.match(regex);
            const originalCasing = match ? match[1] : bestTerm;

            // Mask the key concept in the sentence
            const maskedSentence = sentence.replace(regex, '__________');
            const stem = `Fill in the blank with the appropriate technical concept:\n"${maskedSentence}"`;

            if (!usedStems.has(stem)) {
                const distractors = selectDistractors(originalCasing, topKeywords, domainHint);
                const { options, correct } = packageOptions(originalCasing, distractors);

                generatedQuestions.push({
                    id: generatedQuestions.length + 1,
                    question: stem,
                    options,
                    correct,
                    explanation: `Complete reference statement: "${sentence}". The missing term is '${formatConceptName(originalCasing)}' (TF-IDF salience score: ${maxWeight.toFixed(2)}).`,
                    algorithm: "TF-IDF Salience Masking & Semantic Distractor Ranking",
                    keyConcept: formatConceptName(originalCasing),
                    difficulty: docMetrics.difficulty
                });

                usedStems.add(stem);
                usedTargetTerms.add(bestTerm.toLowerCase());
            }
        }
    }

    // Pass 3: True Concept / Attribute Inquiry if more questions needed
    for (const item of rankedSentences) {
        if (generatedQuestions.length >= numQuestions) break;
        const sentence = item.sentence;

        // Choose a prominent keyword
        const topTerm = topKeywords.find(kw => !usedTargetTerms.has(kw.term.toLowerCase()));
        if (topTerm) {
            const termName = formatConceptName(topTerm.term);
            const stem = `Which of the following statements is directly supported regarding "${termName}"?`;

            if (!usedStems.has(stem)) {
                const correctAnswerText = sentence.length > 120 ? sentence.slice(0, 117) + "..." : sentence;
                
                // Plausible alternative distractors formulated from other sentences or domain concepts
                const distractors = [
                    `It is completely deprecated and has been superseded by legacy hardware registers.`,
                    `It guarantees strictly zero computational overhead in all distributed scenarios.`,
                    `It functions solely as a peripheral input handler without interacting with memory.`
                ];

                const { options, correct } = packageOptions(correctAnswerText, distractors);

                generatedQuestions.push({
                    id: generatedQuestions.length + 1,
                    question: stem,
                    options,
                    correct,
                    explanation: `Original document passage: "${sentence}".`,
                    algorithm: "TF-IDF Passage Validation & Semantic Distractor Formulation",
                    keyConcept: termName,
                    difficulty: docMetrics.difficulty
                });

                usedStems.add(stem);
                usedTargetTerms.add(topTerm.term.toLowerCase());
            }
        }
    }

    return {
        topic: "Document AI Assessment",
        count: generatedQuestions.length,
        questions: generatedQuestions,
        nlpMetadata: {
            algorithm: "TF-IDF Keyword Extraction + Sentence Salience + Semantic Distractor Ranking",
            topKeywords: topKeywords.slice(0, 10),
            totalSentences: sentences.length,
            wordCount: docMetrics.wordCount,
            readingEase: docMetrics.readingEase,
            difficulty: docMetrics.difficulty
        }
    };
}

/**
 * Cosine Similarity Semantic Search against the question bank
 * Vectorizes text and computes dot product over norm against each question.
 */
function searchQuestionsByCosineSimilarity(text, questionBank, limit = 5) {
    const inputWords = tokenizeWords(text);
    const inputBigrams = extractNgrams(inputWords, 2);
    const inputTerms = [...inputWords, ...inputBigrams];

    // Compute input frequency vector
    const inputTf = {};
    inputTerms.forEach(t => { inputTf[t] = (inputTf[t] || 0) + 1; });

    let inputNormSq = 0;
    for (const count of Object.values(inputTf)) {
        inputNormSq += count * count;
    }
    const inputNorm = Math.sqrt(inputNormSq) || 1;

    // Score each question in the bank
    const scored = questionBank.map(q => {
        const qText = `${q.topic} ${q.question} ${q.option_a} ${q.option_b} ${q.option_c} ${q.option_d} ${q.explanation}`;
        const qWords = tokenizeWords(qText);
        const qBigrams = extractNgrams(qWords, 2);
        const qTerms = [...qWords, ...qBigrams];

        const qTf = {};
        qTerms.forEach(t => { qTf[t] = (qTf[t] || 0) + 1; });

        let dotProduct = 0;
        let qNormSq = 0;

        for (const [term, count] of Object.entries(qTf)) {
            qNormSq += count * count;
            if (inputTf[term]) {
                dotProduct += count * inputTf[term];
            }
        }

        const qNorm = Math.sqrt(qNormSq) || 1;
        const cosineSim = dotProduct / (inputNorm * qNorm);

        return { question: q, similarity: cosineSim };
    });

    // Sort descending by similarity
    scored.sort((a, b) => b.similarity - a.similarity);

    return scored.slice(0, limit).map((item, idx) => ({
        id: idx + 1,
        question: (item.question.question || '').replace(/^Item\s*#\d+:\s*/i, '').trim(),
        options: {
            A: item.question.option_a,
            B: item.question.option_b,
            C: item.question.option_c,
            D: item.question.option_d
        },
        correct: item.question.correct_option,
        explanation: (item.question.explanation || '').replace(/^Item\s*#\d+:\s*/i, '').trim(),
        similarity: parseFloat(item.similarity.toFixed(4)),
        algorithm: "Vector Space Model (VSM) & Cosine Similarity Match"
    }));
}

module.exports = {
    cleanTechnicalText,
    tokenizeSentences,
    tokenizeWords,
    computeTfIdf,
    calculateDocumentMetrics,
    generateAIQuizFromText,
    searchQuestionsByCosineSimilarity,
    DOMAIN_DISTRACTORS
};
