# PDF Question Answering System (RAG)

A **Retrieval-Augmented Generation (RAG)** application that answers questions about PDF documents using only the document's content—no hallucinations, no outside knowledge.

**Author:** Mayank Bansal | **Status:** Feature-complete | **Type:** Learning Project

## Overview

Instead of relying on the model's general knowledge, this system retrieves relevant document chunks and grounds answers strictly in that context. If information isn't in the PDF, the system responds with "I don't know."

**Core idea:** Combine semantic search + LLM generation to create accurate, document-grounded Q&A.

## Features

- 📄 **PDF Upload** – Drag-and-drop with real-time processing feedback
- 🔍 **Semantic Search** – FAISS-powered vector retrieval with relevance filtering  
- 🛡️ **Hallucination Prevention** – Distance thresholds + guarded prompts
- 📋 **Source Attribution** – Shows which document chunks answers came from
- 💻 **Full-Stack** – Flask backend + vanilla JavaScript frontend
- 🎨 **Responsive UI** – Modern design with smooth animations and mobile friendly

## Architecture

```
PDF Upload → Text Extraction → Chunking (500 chars, 100 overlap)
                                    ↓
                          Embedding (all-MiniLM-L6-v2)
                                    ↓
                          Vector Storage (FAISS)
                                    ↓
User Question → Query Embedding → Semantic Search (top-5)
                                    ↓
                          Relevance Filter (L2 distance ≤ 1.2)
                                    ↓
                    Prompt Building + Context Injection
                                    ↓
                    Gemini 2.5 Flash Answer Generation
```

**Why this approach works:**
- ✅ Retrieval grounds answers in document content
- ✅ Distance filtering removes weak matches
- ✅ Guarded prompts prevent model from using outside knowledge
- ✅ Users see source chunks for verification

## Project Structure

```
.
├── app.py                      # Flask backend + RAG pipeline
├── pdf_text_extracter.py       # PDF text extraction
├── templates/index.html        # Web UI
├── static/
│   ├── script.js              # Frontend logic
│   └── style.css              # Styling
├── uploads/                   # User uploaded PDFs
└── sample.pdf                 # Example document
```

## Setup

### Requirements
- Python 3.8+
- Google Gemini API key

### Installation

```bash
# Install dependencies
pip install flask langchain sentence-transformers faiss-cpu pypdf google-generativeai werkzeug

# Set API key
# Windows (PowerShell):
$env:API_KEY = "your_gemini_api_key"

# macOS / Linux:
export API_KEY="your_gemini_api_key"

# Run
python app.py

# Open http://localhost:5000
```

**Get API key:** https://aistudio.google.com/app/apikey

## RAG Workflow

1. Extract text from PDF (PyPDF)
2. Split into overlapping chunks (LangChain)
3. Generate embeddings (Sentence-Transformers)
4. Store in FAISS index (L2 distance)
5. Embed user query
6. Retrieve top-5 most similar chunks
7. Filter by distance threshold
8. Build prompt with retrieved context
9. Generate answer via Gemini
10. Return answer + source chunks or "I don't know"

## Key Configurations

```python
# In app.py - tune these for your use case:
chunk_size = 500              # Larger = more context per chunk
chunk_overlap = 100           # Overlap prevents context loss
k = 5                         # Top-k chunks to retrieve
max_distance = 1.2            # Relevance threshold (lower = stricter)
MAX_FILE_SIZE = 50*1024*1024  # 50MB upload limit
```

## Performance

- PDF processing: 2-5 seconds
- Embedding: 1-3 seconds
- Query retrieval: <1 second
- Answer generation: 3-8 seconds
- **Total:** ~5-15 seconds per question

## Learning Outcomes

This project demonstrates:

**Machine Learning & NLP**
- Vector embeddings and semantic similarity
- Information retrieval techniques
- RAG system design
- Prompt engineering for guardrails

**Full-Stack Development**
- Flask backend with file uploads
- RESTful API design
- Async JavaScript & DOM manipulation
- State management

**Software Engineering**
- Error handling & validation
- File security (secure filenames, size limits)
- User feedback mechanisms
- Clean, documented code

## Example Usage

1. **Upload a PDF** – Drag-and-drop onto the upload box
2. **Ask a question** – "What are the main findings?"
3. **Get answer** – Grounded in PDF content with source chunks

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "No PDF loaded" | Upload a PDF first |
| Invalid API key | Check https://aistudio.google.com/app/apikey |
| PDF won't process | Ensure it has selectable text (not scanned image) |
| Port already in use | Change port in `app.py` |

## Dependencies

| Package | Purpose |
|---------|---------|
| Flask | Web framework |
| LangChain | Text chunking |
| sentence-transformers | Embeddings |
| FAISS | Vector search |
| PyPDF | PDF extraction |
| google-generativeai | Gemini API |

## Design Notes

**Why these tools?**
- **Sentence-Transformers:** Lightweight, offline, excellent semantic search
- **FAISS:** Fast exact nearest neighbors, memory efficient
- **Gemini 2.5 Flash:** Fast model, optimized for streaming
- **Flask:** Simple, perfect for prototyping

## Notes

- This is a learning prototype, not production code
- Indexing happens once at startup
- Retrieval quality depends on chunking strategy and thresholds
- Works best with documents that have clear structure

## Future Ideas

- [ ] Multiple PDF support
- [ ] Chat history & conversation context
- [ ] OCR for scanned PDFs
- [ ] Export answers as PDF
- [ ] User authentication
- [ ] Streaming responses

---

**Created:** January 2026  
**Last Updated:** January 2, 2026

*Built as a learning exercise in RAG systems, full-stack development, and ML engineering.*
