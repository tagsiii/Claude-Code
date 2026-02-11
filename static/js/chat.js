/**
 * Navy QOL Chatbot - Client-side chat logic
 */
(function () {
    const chatArea = document.getElementById("chatArea");
    const chatForm = document.getElementById("chatForm");
    const userInput = document.getElementById("userInput");
    const sendBtn = document.getElementById("sendBtn");
    const uploadToggle = document.getElementById("uploadToggle");
    const uploadPanel = document.getElementById("uploadPanel");
    const uploadForm = document.getElementById("uploadForm");
    const uploadCancel = document.getElementById("uploadCancel");
    const uploadStatus = document.getElementById("uploadStatus");

    // --- Markdown-lite renderer ---
    function renderMarkdown(text) {
        let html = text
            // Headers
            .replace(/^### (.+)$/gm, "<h3>$1</h3>")
            .replace(/^## (.+)$/gm, "<h3>$1</h3>")
            // Bold
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
            // Italic
            .replace(/\*(.+?)\*/g, "<em>$1</em>")
            // Horizontal rule
            .replace(/^---$/gm, "<hr>")
            // Unordered list items
            .replace(/^- (.+)$/gm, "<li>$1</li>");

        // Wrap consecutive <li> in <ul>
        html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");

        // Paragraphs: split by double newline
        html = html
            .split(/\n{2,}/)
            .map(function (block) {
                block = block.trim();
                if (!block) return "";
                if (
                    block.startsWith("<h") ||
                    block.startsWith("<ul") ||
                    block.startsWith("<hr")
                ) {
                    return block;
                }
                return "<p>" + block.replace(/\n/g, "<br>") + "</p>";
            })
            .join("\n");

        return html;
    }

    // --- Message display ---
    function addMessage(text, sender) {
        const div = document.createElement("div");
        div.className = "message " + sender;
        if (sender === "bot") {
            div.innerHTML = renderMarkdown(text);
        } else {
            div.textContent = text;
        }
        chatArea.appendChild(div);
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    function showTyping() {
        const div = document.createElement("div");
        div.className = "typing-indicator";
        div.id = "typingIndicator";
        div.innerHTML = "Looking up Navy resources<span>...</span>";
        chatArea.appendChild(div);
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    function hideTyping() {
        const el = document.getElementById("typingIndicator");
        if (el) el.remove();
    }

    // --- API calls ---
    async function sendMessage(text) {
        addMessage(text, "user");
        userInput.value = "";
        sendBtn.disabled = true;
        showTyping();

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text }),
            });
            const data = await res.json();
            hideTyping();
            addMessage(data.reply, "bot");
        } catch (err) {
            hideTyping();
            addMessage(
                "Sorry, I encountered an error connecting to the server. Please try again.",
                "bot"
            );
        }
        sendBtn.disabled = false;
        userInput.focus();
    }

    async function loadWelcome() {
        try {
            const res = await fetch("/api/welcome");
            const data = await res.json();
            addMessage(data.reply, "bot");
        } catch (err) {
            addMessage(
                "Welcome to the Navy QOL Assistant. Ask me about Fleet & Family programs, Navy HR policies, or any quality of life topic.",
                "bot"
            );
        }
    }

    // --- Event handlers ---
    chatForm.addEventListener("submit", function (e) {
        e.preventDefault();
        const text = userInput.value.trim();
        if (!text) return;
        sendMessage(text);
    });

    uploadToggle.addEventListener("click", function () {
        uploadPanel.classList.toggle("open");
    });

    uploadCancel.addEventListener("click", function () {
        uploadPanel.classList.remove("open");
        uploadStatus.textContent = "";
        uploadStatus.className = "upload-status";
    });

    uploadForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const formData = new FormData(uploadForm);
        uploadStatus.textContent = "Uploading and processing...";
        uploadStatus.className = "upload-status";

        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            if (res.ok) {
                uploadStatus.textContent = data.message;
                uploadStatus.className = "upload-status success";
                uploadForm.reset();
                addMessage(
                    "A new publication has been added to my knowledge base. I can now answer questions about its content.",
                    "bot"
                );
            } else {
                uploadStatus.textContent = data.error || "Upload failed.";
                uploadStatus.className = "upload-status error";
            }
        } catch (err) {
            uploadStatus.textContent = "Network error. Please try again.";
            uploadStatus.className = "upload-status error";
        }
    });

    // --- Init ---
    loadWelcome();
})();
