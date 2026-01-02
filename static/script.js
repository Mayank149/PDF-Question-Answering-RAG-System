// ============================================
// DOM ELEMENTS
// ============================================

const askBtn = document.getElementById("askBtn");
const clearBtn = document.getElementById("clearBtn");
const questionInput = document.getElementById("questionInput");
const answerText = document.getElementById("answerText");
const sourcesDiv = document.getElementById("sources");
const loadingDiv = document.getElementById("loading");
const answerContainer = document.getElementById("answerContainer");
const sourcesContainer = document.getElementById("sourcesContainer");
const errorContainer = document.getElementById("errorContainer");
const errorText = document.getElementById("errorText");
const sourceCount = document.getElementById("sourceCount");

// PDF Upload elements
const pdfInput = document.getElementById("pdfInput");
const uploadBox = document.querySelector(".upload-box");
const uploadStatus = document.getElementById("uploadStatus");
const uploadStatusText = document.getElementById("uploadStatusText");
const statusContainer = document.getElementById("statusContainer");
const statusText = document.getElementById("statusText");

// Settings elements
const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const apiKeyInput = document.getElementById("apiKeyInput");
const testApiBtn = document.getElementById("testApiBtn");
const saveApiBtn = document.getElementById("saveApiBtn");
const apiKeyStatus = document.getElementById("apiKeyStatus");
const apiKeyStatusText = document.getElementById("apiKeyStatusText");

// ============================================
// STATE MANAGEMENT
// ============================================

let isLoading = false;
let isPdfLoaded = false;
let apiKey = localStorage.getItem("gemini_api_key") || "";

// ============================================
// EVENT LISTENERS
// ============================================

askBtn.addEventListener("click", handleAskQuestion);
clearBtn.addEventListener("click", handleClear);

// Settings modal events
settingsBtn.addEventListener("click", openSettings);
closeSettingsBtn.addEventListener("click", closeSettings);
testApiBtn.addEventListener("click", testApiKey);
saveApiBtn.addEventListener("click", saveApiKey);

// Close modal when clicking outside
settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) closeSettings();
});

// PDF upload events
pdfInput.addEventListener("change", handleFileSelect);
uploadBox.addEventListener("dragover", handleDragOver);
uploadBox.addEventListener("dragleave", handleDragLeave);
uploadBox.addEventListener("drop", handleDrop);

// Allow Enter key to submit (Shift+Enter for new line)
questionInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && questionInput.value.trim()) {
        e.preventDefault();
        handleAskQuestion();
    }
});

// Enable/disable button based on input
questionInput.addEventListener("input", () => {
    askBtn.disabled = !questionInput.value.trim() || isLoading || !isPdfLoaded;
});

// ============================================
// SETTINGS FUNCTIONS
// ============================================

function openSettings() {
    settingsModal.classList.remove("hidden");
    apiKeyInput.value = apiKey;
    apiKeyInput.focus();
    hideApiKeyStatus();
}

function closeSettings() {
    settingsModal.classList.add("hidden");
    hideApiKeyStatus();
}

async function testApiKey() {
    const key = apiKeyInput.value.trim();
    
    if (!key) {
        showApiKeyStatus("Please enter an API key", "error");
        return;
    }
    
    showApiKeyStatus("Testing API key...", "loading");
    testApiBtn.disabled = true;
    
    try {
        const response = await fetch("/test-api-key", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ api_key: key })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showApiKeyStatus("✓ API key is valid!", "success");
        } else {
            showApiKeyStatus(`✗ ${data.error || "Invalid API key"}`, "error");
        }
    } catch (error) {
        showApiKeyStatus(`✗ Error testing API key: ${error.message}`, "error");
    } finally {
        testApiBtn.disabled = false;
    }
}

function saveApiKey() {
    const key = apiKeyInput.value.trim();
    
    if (!key) {
        showApiKeyStatus("Please enter an API key", "error");
        return;
    }
    
    apiKey = key;
    localStorage.setItem("gemini_api_key", key);
    showApiKeyStatus("✓ API key saved successfully", "success");
    
    setTimeout(() => {
        closeSettings();
    }, 1500);
}

function showApiKeyStatus(message, type) {
    apiKeyStatusText.textContent = message;
    apiKeyStatus.classList.remove("hidden", "success", "error", "loading");
    apiKeyStatus.classList.add(type);
}

function hideApiKeyStatus() {
    apiKeyStatus.classList.add("hidden");
}

// ============================================
// PDF UPLOAD FUNCTIONS
// ============================================

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadBox.classList.add("dragover");
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadBox.classList.remove("dragover");
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadBox.classList.remove("dragover");
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        pdfInput.files = files;
        handleFileSelect();
    }
}

async function handleFileSelect() {
    const file = pdfInput.files[0];
    
    if (!file) return;
    
    if (!file.name.endsWith('.pdf')) {
        showUploadError("Please select a valid PDF file");
        return;
    }
    
    if (file.size > 50 * 1024 * 1024) {
        showUploadError("File size exceeds 50MB limit");
        return;
    }
    
    await uploadPdf(file);
}

async function uploadPdf(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    showUploadLoading();
    hideAllResults();
    
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            headers: {
                "X-API-Key": apiKey
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            showUploadError(data.error || "Failed to upload PDF");
            return;
        }
        
        // Success
        showUploadSuccess(data);
        updatePdfStatus(data.filename, data.chunks, data.vectors);
        isPdfLoaded = true;
        questionInput.disabled = false;
        askBtn.disabled = !questionInput.value.trim();
        
    } catch (error) {
        showUploadError(`Error uploading PDF: ${error.message}`);
    }
}

function showUploadLoading() {
    uploadStatus.innerHTML = '<p id="uploadStatusText">Uploading and processing PDF...</p>';
    uploadStatus.classList.remove("hidden", "success", "error");
    uploadStatus.classList.add("loading");
}

function showUploadSuccess(data) {
    uploadStatus.innerHTML = `
        <p id="uploadStatusText">
            ✓ ${data.filename} loaded successfully
            <br><small>${data.chunks} chunks • ${data.vectors} vectors</small>
        </p>
    `;
    uploadStatus.classList.remove("hidden", "error", "loading");
    uploadStatus.classList.add("success");
}

function showUploadError(message) {
    uploadStatus.innerHTML = `<p id="uploadStatusText">✗ ${message}</p>`;
    uploadStatus.classList.remove("hidden", "success", "loading");
    uploadStatus.classList.add("error");
}

function updatePdfStatus(filename, chunks, vectors) {
    statusText.textContent = `📄 ${filename} • ${chunks} chunks • ${vectors} vectors`;
    statusContainer.classList.remove("hidden");
}

// ============================================
// MAIN FUNCTIONS
// ============================================

async function handleAskQuestion() {
    const question = questionInput.value.trim();

    if (!question) {
        showError("Please enter a question");
        return;
    }

    if (isLoading) return;

    isLoading = true;
    askBtn.disabled = true;
    clearBtn.disabled = true;

    // Hide previous results
    hideAllResults();
    showLoading();

    try {
        const response = await fetch("/ask", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": apiKey
            },
            body: JSON.stringify({ question })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();

        // Display answer
        displayAnswer(data.answer);

        // Display sources
        if (data.sources && data.sources.length > 0) {
            displaySources(data.sources);
        }

        // Clear error if previously shown
        hideError();

    } catch (error) {
        console.error("Error:", error);
        showError(`Error contacting server: ${error.message}`);
    } finally {
        hideLoading();
        isLoading = false;
        askBtn.disabled = false;
        clearBtn.disabled = false;
        askBtn.focus();
    }
}

function handleClear() {
    questionInput.value = "";
    hideAllResults();
    questionInput.focus();
    askBtn.disabled = true;
}

// ============================================
// UI UPDATE FUNCTIONS
// ============================================

function displayAnswer(answer) {
    answerText.textContent = answer;
    answerContainer.classList.remove("hidden");
    
    // Scroll to answer
    setTimeout(() => {
        answerContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
}

function displaySources(sources) {
    sourcesDiv.innerHTML = "";
    sourceCount.textContent = `${sources.length} source${sources.length !== 1 ? "s" : ""}`;

    sources.forEach((src, idx) => {
        const div = document.createElement("div");
        div.className = "source-block";
        
        const sourceText = src.source || "Unknown Source";
        const distance = src.distance ? src.distance.toFixed(2) : "N/A";
        
        div.innerHTML = `
            <strong>📄 Source ${idx + 1}</strong>
            <p>${sanitizeHtml(src.text)}</p>
        `;
        
        sourcesDiv.appendChild(div);
    });

    sourcesContainer.classList.remove("hidden");
    
    // Scroll to sources
    setTimeout(() => {
        sourcesContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
}

function showLoading() {
    loadingDiv.classList.remove("hidden");
}

function hideLoading() {
    loadingDiv.classList.add("hidden");
}

function showError(message) {
    errorText.textContent = message;
    errorContainer.classList.remove("hidden");
    
    setTimeout(() => {
        errorContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
}

function hideError() {
    errorContainer.classList.add("hidden");
}

function hideAllResults() {
    answerContainer.classList.add("hidden");
    sourcesContainer.classList.add("hidden");
    hideError();
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function sanitizeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function showInitialMessage() {
    uploadStatus.innerHTML = '<p id="uploadStatusText">👋 Please upload a PDF to get started</p>';
    uploadStatus.classList.remove("hidden");
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener("DOMContentLoaded", async () => {
    askBtn.disabled = true;
    questionInput.disabled = true;
    
    // Check if a PDF is already loaded
    try {
        const response = await fetch('/status');
        const data = await response.json();
        
        if (data.loaded) {
            updatePdfStatus(data.filename, data.chunks, data.vectors);
            isPdfLoaded = true;
            questionInput.disabled = false;
            askBtn.disabled = true;
        } else {
            showInitialMessage();
        }
    } catch (error) {
        console.error('Error checking PDF status:', error);
    }
});
