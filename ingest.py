"""
Document ingestion module for adding new Navy publications to the knowledge base.
Supports plain text (.txt) and structured JSON (.json) files.
"""
import os
import json
import re
import hashlib

KB_DIR = os.path.join(os.path.dirname(__file__), "knowledge_base")


def _generate_id(text):
    """Generate a short unique ID from content."""
    return "usr-" + hashlib.md5(text.encode()).hexdigest()[:8]


def _extract_tags(text):
    """Extract basic keyword tags from text."""
    # Common Navy QOL terms to detect
    tag_patterns = {
        "leave": r"\bleave\b",
        "pcs": r"\bpcs\b",
        "bah": r"\bbah\b",
        "tricare": r"\btricare\b",
        "deployment": r"\bdeploy",
        "childcare": r"\bchild\s*(care|development)",
        "education": r"\b(tuition|education|college|gi\s*bill)\b",
        "financial": r"\b(financial|budget|pay|allowance)\b",
        "counseling": r"\bcounsel",
        "legal": r"\blegal\b",
        "housing": r"\bhousing\b",
        "advancement": r"\b(advance|promot)",
        "family": r"\bfamily\b",
        "spouse": r"\bspouse\b",
        "mental health": r"\bmental\s*health\b",
        "mwr": r"\bmwr\b",
        "efmp": r"\befmp\b",
        "sapr": r"\bsapr\b",
        "fap": r"\bfap\b",
        "transition": r"\btransition\b",
    }
    text_lower = text.lower()
    tags = []
    for tag, pattern in tag_patterns.items():
        if re.search(pattern, text_lower):
            tags.append(tag)
    return tags


def ingest_text_file(filepath, category="Uploaded Publication", source=None, chunk_size=500):
    """
    Ingest a plain text file by splitting into chunks and saving to the knowledge base.
    Each chunk becomes a searchable entry.
    """
    if source is None:
        source = os.path.basename(filepath)

    with open(filepath, "r", errors="replace") as f:
        text = f.read()

    # Split into paragraphs, then group into chunks
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    entries = []
    current_chunk = []
    current_len = 0

    for para in paragraphs:
        if current_len + len(para) > chunk_size and current_chunk:
            chunk_text = " ".join(current_chunk)
            entries.append({
                "id": _generate_id(chunk_text),
                "source": source,
                "category": category,
                "title": f"{source} - Section {len(entries) + 1}",
                "content": chunk_text,
                "tags": _extract_tags(chunk_text),
            })
            current_chunk = []
            current_len = 0
        current_chunk.append(para)
        current_len += len(para)

    # Remaining text
    if current_chunk:
        chunk_text = " ".join(current_chunk)
        entries.append({
            "id": _generate_id(chunk_text),
            "source": source,
            "category": category,
            "title": f"{source} - Section {len(entries) + 1}",
            "content": chunk_text,
            "tags": _extract_tags(chunk_text),
        })

    # Save to knowledge base
    out_name = os.path.splitext(os.path.basename(filepath))[0] + "_ingested.json"
    out_path = os.path.join(KB_DIR, out_name)
    with open(out_path, "w") as f:
        json.dump(entries, f, indent=2)

    return len(entries)


def ingest_json_file(filepath):
    """
    Ingest a structured JSON file. Expected format is a list of objects with
    at minimum 'title' and 'content' fields.
    """
    with open(filepath, "r") as f:
        data = json.load(f)

    if not isinstance(data, list):
        data = [data]

    entries = []
    for item in data:
        content = item.get("content", "")
        entry = {
            "id": item.get("id", _generate_id(content)),
            "source": item.get("source", os.path.basename(filepath)),
            "category": item.get("category", "Uploaded Publication"),
            "title": item.get("title", "Untitled Entry"),
            "content": content,
            "tags": item.get("tags", _extract_tags(content)),
        }
        entries.append(entry)

    out_name = os.path.splitext(os.path.basename(filepath))[0] + "_ingested.json"
    out_path = os.path.join(KB_DIR, out_name)
    with open(out_path, "w") as f:
        json.dump(entries, f, indent=2)

    return len(entries)
