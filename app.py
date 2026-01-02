from pdf_text_extracter import load_pdf_text
from langchain_text_splitters import RecursiveCharacterTextSplitter
import google.generativeai as genai
import numpy as np
from sentence_transformers import SentenceTransformer
import faiss
import os
from flask import Flask, request, jsonify, render_template
from werkzeug.utils import secure_filename
import shutil

UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {'pdf'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

# Create uploads folder if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

embed_model = SentenceTransformer("all-MiniLM-L6-v2")
genai.configure(api_key = os.getenv("API_KEY"))

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# Global state for current PDF
current_pdf = None
current_index = None
current_data = None

@app.route("/")
def home():
    return render_template("index.html")

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def chunk_text(text):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size = 500,
        chunk_overlap = 100,
        separators = ["\n\n", "\n", ".", " ", ""]
    )

    chunks = splitter.split_text(text)
    return chunks

def create_chunks_with_metadata(chunks, source):
    chunk_data = []
    for i, chunk in enumerate(chunks):
        chunk_data.append({
            "id" : i,
            "text" : chunk,
            "source" : source
        })
    return chunk_data

def embed_texts(texts):
    embeddings = embed_model.encode(
        texts,
        convert_to_numpy = True,
        show_progress_bar= True
    )
    return embeddings.astype("float32")

def embed_query(query):
    embedding = embed_model.encode(
        query,
        convert_to_numpy= True
    )
    return embedding.astype("float32")

def build_faiss_index(embeddings):
    dim = embeddings.shape[1]
    index = faiss.IndexFlatL2(dim)
    index.add(embeddings)
    return index

def build_vector_store(chunk_data):
    texts = [chunk["text"] for chunk in chunk_data]
    embeddings = embed_texts(texts)
    index = build_faiss_index(embeddings)
    return index, chunk_data

def retrieve_top_k(query, index, chunk_data, k = 5):
    query_vec = embed_query(query)
    D,I = index.search(query_vec.reshape(1,-1), k)
    results = []

    for dis, idx in zip(D[0], I[0]):
        results.append({
            "text" : chunk_data[idx]["text"],
            "source" : chunk_data[idx]["source"],
            "distance" : float(dis)
        })
    return results

def retrieve_with_threshold(query, index, chunk_data, k=5, max_distance=1.2):
    results = retrieve_top_k(query, index, chunk_data, k)

    filtered = [
        r for r in results
        if r["distance"] <= max_distance
    ]

    return filtered

def build_prompt(context_chunks, question):
    context_text = "\n\n".join(
        f"Source {i+1}:\n{chunk["text"]}"
        for i, chunk in enumerate(context_chunks)
    )

    prompt = f"""
    You are a document-based question answering system.
    Rules:
    - Answer using ONLY the provided context.
    - Do NOT use outside knowledge.
    - Do NOT guess or infer.
    - If the answer is not explicitly present, reply exactly: "I don't know".

    Context:
    {context_text}

    Question:
    {question}

    Answer:
    """.strip()

    return prompt

def generate_answer(prompt):
    model = genai.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content(prompt)
    return response.text.strip()

def answer_question(question, index, chunk_data, k = 5, max_distance = 1.2):
    retrieved = retrieve_with_threshold(question, index, chunk_data, k, max_distance)

    if not retrieved:
        return {
            "answer" : "I don't know",
            "sources" : [] 
        }

    prompt = build_prompt(retrieved, question)
    answer = generate_answer(prompt)

    return {
        "answer" : answer,
        "sources" : retrieved
    }

# Initialize with sample.pdf if it exists
try:
    if os.path.exists("sample.pdf"):
        text = load_pdf_text("sample.pdf")
        chunks = chunk_text(text)
        current_data = create_chunks_with_metadata(chunks, "sample.pdf")
        current_index, current_data = build_vector_store(current_data)
        current_pdf = "sample.pdf"
except Exception as e:
    print(f"Warning: Could not load sample.pdf: {e}")
    current_index = None
    current_data = None
    current_pdf = None

@app.route("/upload", methods=["POST"])
def upload_pdf():
    global current_index, current_data, current_pdf
    
    # Check if file is in request
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    if not allowed_file(file.filename):
        return jsonify({"error": "Only PDF files are allowed"}), 400
    
    try:
        # Save the uploaded file
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        # Remove old uploads to save space
        for f in os.listdir(UPLOAD_FOLDER):
            old_path = os.path.join(UPLOAD_FOLDER, f)
            if os.path.isfile(old_path):
                os.remove(old_path)
        
        file.save(filepath)
        
        # Extract text and build vector store
        text = load_pdf_text(filepath)
        
        if not text.strip():
            os.remove(filepath)
            return jsonify({"error": "PDF is empty or could not be read"}), 400
        
        chunks = chunk_text(text)
        current_data = create_chunks_with_metadata(chunks, filename)
        current_index, current_data = build_vector_store(current_data)
        current_pdf = filename
        
        return jsonify({
            "success": True,
            "message": f"PDF '{filename}' uploaded successfully",
            "filename": filename,
            "chunks": len(current_data),
            "vectors": current_index.ntotal
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Error processing PDF: {str(e)}"}), 500

@app.route("/status", methods=["GET"])
def status():
    if current_pdf is None:
        return jsonify({
            "loaded": False,
            "message": "No PDF loaded. Please upload a PDF to get started."
        }), 200
    
    return jsonify({
        "loaded": True,
        "filename": current_pdf,
        "chunks": len(current_data) if current_data else 0,
        "vectors": current_index.ntotal if current_index else 0
    }), 200

@app.route("/ask", methods = ["POST"])
def ask():
    global current_index, current_data
    
    if current_index is None or current_data is None:
        return jsonify({"error": "No PDF loaded. Please upload a PDF first."}), 400
    
    question = request.json.get("question")
    if not question:
        return jsonify({"error": "No question provided"}), 400
    
    result = answer_question(question, current_index, current_data)
    return jsonify(result)
    

if __name__ == "__main__":
    if current_index:
        print(f"Loaded PDF: {current_pdf}")
        print(f"Vectors in index: {current_index.ntotal}")
        print(f"Total chunks: {len(current_data)}")
    else:
        print("No PDF loaded. Upload a PDF through the web interface.")
    
    app.run(debug=True)