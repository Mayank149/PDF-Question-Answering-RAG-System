from pdf_text_extracter import load_pdf_text
from langchain_text_splitters import RecursiveCharacterTextSplitter


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

if __name__ == "__main__":
    text = load_pdf_text("sample.pdf")
    chunks = chunk_text(text)
    data = create_chunks_with_metadata(chunks, "sample.pdf")
    print("Total chunks:", len(data))
    print("\nFirst chunk:\n", data[0]["text"])