from pdf_text_extracter import load_pdf_text
from langchain_text_splitters import RecursiveCharacterTextSplitter
import google.generativeai as genai
import numpy as np
from sentence_transformers import SentenceTransformer
import faiss
import os

embed_model = SentenceTransformer("all-MiniLM-L6-v2")
genai.configure(api_key = os.getenv("API_KEY"))

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

if __name__ == "__main__":
    text = load_pdf_text("sample.pdf")
    chunks = chunk_text(text)
    data = create_chunks_with_metadata(chunks, "sample.pdf")
    index, data = build_vector_store(data)

    query = "What is AI Powered Performance Analyzer?"
    results = retrieve_with_threshold(query, index, data, k=5)

    for r in results:
        print("Distance:", r["distance"])
        print(r["text"])
        print("-" * 40)

    # print("Vectors in index:", index.ntotal)
    # print("Total chunks:", len(data))
    # print("\nFirst chunk:\n", data[0]["text"])