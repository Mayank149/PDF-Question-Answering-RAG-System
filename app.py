from pdf_text_extracter import load_pdf_text
from langchain_text_splitters import RecursiveCharacterTextSplitter
import google.generativeai as genai
import numpy as np
from sentence_transformers import SentenceTransformer
import faiss
import os
from flask import Flask, request, jsonify

embed_model = SentenceTransformer("all-MiniLM-L6-v2")
genai.configure(api_key = os.getenv("API_KEY"))

app = Flask(__name__)

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

text = load_pdf_text("sample.pdf")
chunks = chunk_text(text)
data = create_chunks_with_metadata(chunks, "sample.pdf")
index, data = build_vector_store(data)

@app.route("/ask", methods = ["POST"])
def ask():
    question = request.json("question")
    result = answer_question(question, index, data)
    return jsonify(result)
    

if __name__ == "__main__":

    print(index.ntotal)
    app.run(debug=True)

    # text = load_pdf_text("sample.pdf")
    # chunks = chunk_text(text)
    # data = create_chunks_with_metadata(chunks, "sample.pdf")
    # index, data = build_vector_store(data)

    # query = "who is the prime minister of india?"

    # result = answer_question(query, index, data)

    # print("Answer:\n", result["answer"])
    # print("\nSources:")
    # for s in result["sources"]:
    #     print("-", s["source"])

    # print("Vectors in index:", index.ntotal)
    # print("Total chunks:", len(data))
    # print("\nFirst chunk:\n", data[0]["text"])