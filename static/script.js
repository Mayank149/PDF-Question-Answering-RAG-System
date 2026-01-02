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

// ============================================
// STATE MANAGEMENT
// ============================================

let isLoading = false;

// ============================================
// EVENT LISTENERS
// ============================================

askBtn.addEventListener("click", handleAskQuestion);
clearBtn.addEventListener("click", handleClear);

// Allow Enter key to submit (Shift+Enter for new line)
questionInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && questionInput.value.trim()) {
        e.preventDefault();
        handleAskQuestion();
    }
});

// Enable/disable button based on input
questionInput.addEventListener("input", () => {
    askBtn.disabled = !questionInput.value.trim() || isLoading;
});

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
                "Content-Type": "application/json"
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

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener("DOMContentLoaded", () => {
    askBtn.disabled = true;
    questionInput.focus();
});
