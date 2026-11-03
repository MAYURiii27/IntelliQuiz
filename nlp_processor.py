import sys
import json
import re
import math
from collections import Counter

STOP_WORDS = set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t',
    'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
    'can', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
    'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his',
    'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'let', 'me', 'more', 'most', 'my', 'myself',
    'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves',
    'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs',
    'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under',
    'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why',
    'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves', 'also', 'therefore', 'furthermore',
    'moreover', 'however', 'thus', 'hence', 'etc', 'example', 'given', 'used', 'using', 'based', 'often',
    'within', 'allows', 'provides', 'fig', 'figure', 'page', 'chapter', 'section', 'modern', 'standard'
])

DOMAIN_DISTRACTORS = [
    'Virtual Memory', 'Context Switching', 'Round Robin Scheduling', 'Mutual Exclusion', 
    'Binary Search Tree', 'Relational Schema', 'B-Tree Indexing', 'ACID Properties',
    'Convolutional Neural Network', 'Gradient Descent', 'Support Vector Machine',
    'Transmission Control Protocol', 'Domain Name System', 'Packet Switching',
    'Public Key Infrastructure', 'Symmetric Encryption', 'Zero Trust Architecture',
    'Dynamic Programming', 'Deadlock Detection', 'Counting Semaphore'
]

def clean_text(text: str) -> str:
    text = re.sub(r'page \d+ of \d+', '', text, flags=re.IGNORECASE)
    text = re.sub(r'https?://\S+', '', text)
    return " ".join(text.split())

def tokenize_sentences(text: str) -> list:
    cleaned = clean_text(text)
    raw = re.split(r'(?<=[.?!])\s+', cleaned)
    return [s.strip() for s in raw if len(s.split()) >= 6 and len(s.split()) <= 70]

def tokenize_words(text: str) -> list:
    words = re.findall(r'[a-zA-Z0-9_-]{3,}', text.lower())
    return [w for w in words if w not in STOP_WORDS and not w.isdigit()]

def compute_tfidf(sentences: list):
    n = len(sentences)
    if n == 0:
        return {}, []

    doc_freq = Counter()
    doc_words = []

    for s in sentences:
        words = tokenize_words(s)
        doc_words.append(words)
        for w in set(words):
            doc_freq[w] += 1

    term_weights = {}
    scored_sentences = []

    for idx, s in enumerate(sentences):
        words = doc_words[idx]
        total_w = len(words) or 1
        tf_counts = Counter(words)
        s_score = 0

        for w, c in tf_counts.items():
            tf = c / total_w
            idf = math.log((1 + n) / (1 + doc_freq[w])) + 1.0
            weight = tf * idf
            s_score += weight
            term_weights[w] = term_weights.get(w, 0) + weight

        scored_sentences.append({
            'sentence': s,
            'score': s_score / math.sqrt(total_w)
        })

    scored_sentences.sort(key=lambda x: x['score'], reverse=True)
    return term_weights, scored_sentences

def generate_questions(text: str, num_questions: int = 5) -> list:
    sentences = tokenize_sentences(text)
    if not sentences:
        return []

    term_weights, ranked_sentences = compute_tfidf(sentences)
    top_terms = sorted(term_weights.items(), key=lambda x: x[1], reverse=True)
    top_candidates = [t[0].title() for t in top_terms[:15]]

    quiz = []
    used_targets = set()

    # Pattern definitions
    patterns = [
        (r'([A-Za-z0-9 _-]{3,35})\s+(?:is defined as|can be defined as|refers to|is known as)\s+([^.;]+)', 'definition'),
        (r'the (?:primary|main)?\s*(?:purpose|function|goal) of\s+([A-Za-z0-9 _-]{3,35})\s+is\s+([^.;]+)', 'purpose'),
        (r'([A-Za-z0-9 _-]{3,35})\s+is\s+used\s+(?:to|for)\s+([^.;]+)', 'usage')
    ]

    for item in ranked_sentences:
        if len(quiz) >= num_questions:
            break
        sentence = item['sentence']

        for pat, p_type in patterns:
            match = re.search(pat, sentence, re.IGNORECASE)
            if match:
                raw_subj = match.group(1).strip()
                subj = re.sub(r'^(a|an|the)\s+', '', raw_subj, flags=re.IGNORECASE).title()
                definition = match.group(2).strip()

                if len(subj) >= 3 and subj.lower() not in used_targets and subj.lower() not in STOP_WORDS:
                    if p_type == 'definition':
                        q_stem = f'According to the text, which concept is defined as: "{definition}"?'
                    elif p_type == 'purpose':
                        q_stem = f'Which mechanism has the primary purpose of: "{definition}"?'
                    else:
                        q_stem = f'In this system, what is specifically used to: "{definition}"?'

                    # Build distractors
                    distractors = []
                    for c in top_candidates + DOMAIN_DISTRACTORS:
                        if c.lower() != subj.lower() and c not in distractors:
                            distractors.append(c)
                        if len(distractors) >= 3:
                            break

                    options = [subj] + distractors[:3]
                    opts_dict = {'A': options[0], 'B': options[1], 'C': options[2], 'D': options[3]}

                    quiz.append({
                        'id': len(quiz) + 1,
                        'question': q_stem,
                        'options': opts_dict,
                        'correct': 'A',
                        'explanation': f'Context from text: "{sentence}".',
                        'algorithm': 'NLP Rule-based & TF-IDF Extraction'
                    })
                    used_targets.add(subj.lower())
                    break

    return quiz

if __name__ == "__main__":
    input_data = sys.stdin.read()
    if not input_data.strip():
        print(json.dumps([]))
        sys.exit(0)

    try:
        payload = json.loads(input_data)
        doc_text = payload.get("text", "")
        num_q = int(payload.get("numQuestions", 5))
        result = generate_questions(doc_text, num_q)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps([]))
