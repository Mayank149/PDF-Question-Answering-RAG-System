from pypdf import PdfReader

def load_pdf_text(path):
    reader = PdfReader(path)
    full_text = ""

    for page in reader.pages:
        text = page.extract_text()
        if text:
            full_text += text + "\n"
    
    return full_text
